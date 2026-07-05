import { FormEvent, MouseEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { buildDisplayedRecents } from '../core/recents/build-displayed-recents';
import type { Artifact, Comment, ProposalMutationResult, ProposalSetRecord, RecentArtifact, RevisionRecord } from '../core/types';
import { formatRecentActivity } from './lib/formatting';
import { readJsonResponse } from './lib/read-json-response';
import { ProposalInlineCard } from './components/ProposalInlineCard';
import { ProposalThreadFooter } from './components/ProposalThreadFooter';
import { ReaderStatusBanner } from './components/ReaderStatusBanner';
import {
  renderDrawerAgentActionLabel,
  renderDrawerAgentStatusLabel,
  renderRailAgentHint,
  summarizeAgentStatus,
  type AgentAuthStatus
} from './web/agent-auth';

const DEFAULT_ARTIFACT_PATH = 'docs/project-brief.md';
const COMPOSER_DRAFT_STORAGE_PREFIX = 'workshop:composer-draft:';
const DEMO_RECENT_CANDIDATES: RecentArtifact[] = [
  {
    title: 'v0-technical-plan.md',
    relativePath: 'workshop/docs/v0-technical-plan.md',
    updatedAt: null,
    lastOpenedAt: null,
    lastDiscussedAt: null,
    commentCount: 0
  },
  {
    title: 'board-format.md',
    relativePath: 'tasks/docs/board-format.md',
    updatedAt: null,
    lastOpenedAt: null,
    lastDiscussedAt: null,
    commentCount: 0
  }
];

type ArtifactPayload = {
  artifact?: Artifact;
  proposalSet?: ProposalSetRecord | null;
  latestProposalSet?: ProposalSetRecord | null;
  proposalHistory?: ProposalSetRecord[];
  revisions?: RevisionRecord[];
  error?: string;
};

type AgentTurnPayload = ArtifactPayload & {
  messages?: Array<{
    id: string;
    authorType: 'agent';
    body: string;
    createdAt: string;
    sectionId: string | null;
  }>;
};

export function App() {
  const initialPath = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('path') ?? DEFAULT_ARTIFACT_PATH;
  }, []);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerFrameRef = useRef<HTMLFormElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const viewportMetricsRef = useRef({
    height: window.innerHeight,
    offsetTop: 0
  });
  const focusFollowTimeoutRef = useRef<number | null>(null);
  const focusFollowFrameRef = useRef<number | null>(null);
  const [artifactPath, setArtifactPath] = useState(initialPath);
  const [draftPath, setDraftPath] = useState(initialPath);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [recentArtifacts, setRecentArtifacts] = useState<RecentArtifact[]>([]);
  const [activeProposalSet, setActiveProposalSet] = useState<ProposalSetRecord | null>(null);
  const [proposalHistory, setProposalHistory] = useState<ProposalSetRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerBody, setComposerBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [agentTurnPending, setAgentTurnPending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [attachedSectionId, setAttachedSectionId] = useState<string | null>(null);
  const [proposalCompareModeById, setProposalCompareModeById] = useState<Record<string, 'original' | 'proposed'>>({});
  const [hasRemoteUpdate, setHasRemoteUpdate] = useState(false);
  const [lastLoadedUpdatedAt, setLastLoadedUpdatedAt] = useState<string | null>(null);
  const [agentAuth, setAgentAuth] = useState<AgentAuthStatus | null>(null);
  const [agentAuthLoading, setAgentAuthLoading] = useState(true);
  const [pendingLocalComment, setPendingLocalComment] = useState<Comment | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editBaseUpdatedAt, setEditBaseUpdatedAt] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [creatingDocument, setCreatingDocument] = useState(false);

  function getComposerDraftStorageKey(path: string) {
    return `${COMPOSER_DRAFT_STORAGE_PREFIX}${path}`;
  }

  function scrollThreadToBottom() {
    const thread = threadRef.current;

    if (!thread) {
      return;
    }

    thread.scrollTop = thread.scrollHeight;
    threadEndRef.current?.scrollIntoView({ block: 'end' });
    composerFrameRef.current?.scrollIntoView({ block: 'end' });
  }

  function stopComposerFocusFollow() {
    if (focusFollowTimeoutRef.current !== null) {
      window.clearTimeout(focusFollowTimeoutRef.current);
      focusFollowTimeoutRef.current = null;
    }

    if (focusFollowFrameRef.current !== null) {
      window.cancelAnimationFrame(focusFollowFrameRef.current);
      focusFollowFrameRef.current = null;
    }
  }

  function startComposerFocusFollow() {
    stopComposerFocusFollow();

    const startedAt = window.performance.now();
    const follow = () => {
      scrollThreadToBottom();

      if (window.performance.now() - startedAt >= 900) {
        focusFollowFrameRef.current = null;
        return;
      }

      focusFollowFrameRef.current = window.requestAnimationFrame(follow);
    };

    focusFollowFrameRef.current = window.requestAnimationFrame(follow);
    focusFollowTimeoutRef.current = window.setTimeout(() => {
      stopComposerFocusFollow();
      scrollThreadToBottom();
    }, 950);
  }

  const sectionById = useMemo(() => {
    return new Map((artifact?.sections ?? []).map((section) => [section.id, section]));
  }, [artifact]);

  const attachedSection = attachedSectionId ? sectionById.get(attachedSectionId) ?? null : null;
  const conversationComments = artifact?.comments ?? [];
  const displayedConversationComments = pendingLocalComment ? [...conversationComments, pendingLocalComment] : conversationComments;
  const resolvedArtifactPath = artifact?.relativePath ?? artifactPath;
  const showOverlay = menuOpen;
  const interactiveOverlay = menuOpen;
  const displayedRecentArtifacts = useMemo(() => {
    return buildDisplayedRecents(artifact, recentArtifacts, conversationComments.length, DEMO_RECENT_CANDIDATES);
  }, [artifact, recentArtifacts, conversationComments.length]);
  const pendingProposalItems = useMemo(() => {
    return activeProposalSet?.items.filter((item) => item.status === 'pending') ?? [];
  }, [activeProposalSet]);
  const proposalItemsBySection = useMemo(() => {
    return new Map(
      pendingProposalItems
        .filter((item) => item.sectionId)
        .map((item) => [item.sectionId as string, item])
    );
  }, [pendingProposalItems]);
  const pendingProposalCount = pendingProposalItems.length;
  const hasPendingProposal = pendingProposalCount > 0;
  const activeProposalAnchorCommentId = useMemo(() => {
    if (!activeProposalSet) {
      return null;
    }

    let anchorCommentId: string | null = null;

    for (const comment of conversationComments) {
      if (comment.authorType === 'agent' && comment.createdAt === activeProposalSet.createdAt) {
        anchorCommentId = comment.id;
      }
    }

    return anchorCommentId;
  }, [activeProposalSet, conversationComments]);
  const proposalTimelineEntries = useMemo(() => {
    return proposalHistory.map((proposalSet) => {
      let anchorCommentId: string | null = null;

    for (const comment of conversationComments) {
        if (comment.authorType === 'agent' && comment.createdAt === proposalSet.createdAt) {
          anchorCommentId = comment.id;
        }
      }

      return {
        proposalSet,
        anchorCommentId
      };
    });
  }, [proposalHistory, conversationComments]);
  const proposalTimelineByAnchorCommentId = useMemo(() => {
    const mapped = new Map<string, ProposalSetRecord[]>();

    for (const entry of proposalTimelineEntries) {
      if (!entry.anchorCommentId) {
        continue;
      }

      const current = mapped.get(entry.anchorCommentId) ?? [];
      current.push(entry.proposalSet);
      mapped.set(entry.anchorCommentId, current);
    }

    return mapped;
  }, [proposalTimelineEntries]);
  const unattachedProposalTimeline = useMemo(() => {
    return proposalTimelineEntries
      .filter((entry) => !entry.anchorCommentId)
      .map((entry) => entry.proposalSet);
  }, [proposalTimelineEntries]);
  const pendingTurnMessage = activeProposalSet
    ? attachedSection
      ? `Working on a revision for ${attachedSection.headingText}…`
      : 'Working on a revision…'
    : attachedSection
      ? `Reviewing ${attachedSection.headingText}…`
      : 'Reviewing the document…';
  const hasStalePendingProposals = hasRemoteUpdate && pendingProposalItems.length > 0;
  const reviewStateLabel = activeProposalSet
    ? `${pendingProposalCount} ${pendingProposalCount === 1 ? 'change' : 'changes'}`
    : null;
  const activeProposalTargetSectionIds = useMemo(() => {
    if (!activeProposalSet) {
      return [];
    }

    const sectionScopedItems = pendingProposalItems.length > 0 ? pendingProposalItems : activeProposalSet.items;
    const ids: string[] = [];
    const seen = new Set<string>();

    for (const item of sectionScopedItems) {
      if (!item.sectionId || seen.has(item.sectionId)) {
        continue;
      }

      seen.add(item.sectionId);
      ids.push(item.sectionId);
    }

    if (ids.length === 0 && activeProposalSet.focusedSectionId) {
      ids.push(activeProposalSet.focusedSectionId);
    }

    return ids;
  }, [activeProposalSet, pendingProposalItems]);
  const activeProposalTargetSections = useMemo(() => {
    return activeProposalTargetSectionIds
      .map((sectionId) => sectionById.get(sectionId) ?? null)
      .filter((section): section is NonNullable<typeof section> => section !== null);
  }, [activeProposalTargetSectionIds, sectionById]);
  const activeProposalPrimarySectionId =
    activeProposalTargetSectionIds[0] ?? activeProposalSet?.focusedSectionId ?? pendingProposalItems[0]?.sectionId ?? null;
  const activeProposalSpansMultipleSections = activeProposalTargetSections.length > 1;
  const activeProposalContextLabel = activeProposalSpansMultipleSections
    ? `${activeProposalTargetSections.length} sections`
    : activeProposalTargetSections[0]?.headingText ?? null;
  const activeProposalTargetSummary = activeProposalSpansMultipleSections
    ? activeProposalTargetSections.map((section) => section.headingText).join(', ')
    : null;
  const activeProposalReviewIndex = useMemo(() => {
    if (!attachedSectionId) {
      return -1;
    }

    return activeProposalTargetSectionIds.indexOf(attachedSectionId);
  }, [activeProposalTargetSectionIds, attachedSectionId]);
  const reviewStateCanCycle = activeProposalTargetSectionIds.length > 0;
  const reviewStateCycleLabel = activeProposalTargetSectionIds.length > 1
    ? activeProposalReviewIndex >= 0
      ? `${activeProposalReviewIndex + 1}/${activeProposalTargetSectionIds.length}`
      : '›'
    : activeProposalTargetSectionIds.length === 1
      ? '›'
      : null;
  const composerPlaceholder = attachedSection
    ? `Sharpen ${attachedSection.headingText}...`
    : activeProposalSet
      ? 'Nudge this proposal closer...'
      : 'Kick off the next move...';
  const isFreshDocument = useMemo(() => {
    if (!artifact) {
      return false;
    }

    const trimmedMarkdown = artifact.markdown.trim();
    const headingOnlyMarkdown = artifact.sections.length === 1 ? artifact.sections[0]?.markdown.trim() ?? '' : '';

    return (
      displayedConversationComments.length === 0
      && proposalHistory.length === 0
      && trimmedMarkdown.length > 0
      && trimmedMarkdown === headingOnlyMarkdown
    );
  }, [artifact, displayedConversationComments.length, proposalHistory.length]);
  const hasUnsavedEditChanges = editMode && artifact ? editBody !== artifact.markdown : false;
  const interactionLocked = loading || submitting || agentTurnPending || savingEdit || creatingDocument;

  useEffect(() => {
    void loadArtifact(artifactPath);
  }, [artifactPath]);

  useEffect(() => {
    void loadRecents();
  }, []);

  useEffect(() => {
    void loadAgentAuthStatus();
  }, []);

  useEffect(() => {
    try {
      const storedDraft = window.localStorage.getItem(getComposerDraftStorageKey(artifactPath));

      if (storedDraft !== null) {
        setComposerBody(storedDraft);
      } else {
        setComposerBody('');
      }
    } catch {
      setComposerBody('');
    }
  }, [artifactPath]);

  useEffect(() => {
    try {
      const storageKey = getComposerDraftStorageKey(artifactPath);

      if (composerBody) {
        window.localStorage.setItem(storageKey, composerBody);
      } else {
        window.localStorage.removeItem(storageKey);
      }
    } catch {
      // Draft persistence is a resilience aid. Ignore storage failures.
    }
  }, [artifactPath, composerBody]);

  useEffect(() => {
    if (agentAuth?.state !== 'connecting') {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadAgentAuthStatus(false);
    }, 2500);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [agentAuth?.state]);

  useEffect(() => {
    const composer = composerRef.current;

    if (!composer) {
      return;
    }

    const computed = window.getComputedStyle(composer);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 20;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(computed.paddingBottom) || 0;
    const borderTop = Number.parseFloat(computed.borderTopWidth) || 0;
    const borderBottom = Number.parseFloat(computed.borderBottomWidth) || 0;
    const maxHeight = (lineHeight * 6) + paddingTop + paddingBottom + borderTop + borderBottom;

    composer.style.height = 'auto';
    composer.style.height = `${Math.min(composer.scrollHeight, maxHeight)}px`;
    composer.style.overflowY = composer.scrollHeight > maxHeight ? 'auto' : 'hidden';
  }, [composerBody, railOpen]);

  useEffect(() => {
    return () => {
      stopComposerFocusFollow();
    };
  }, []);

  useEffect(() => {
    if (!artifact) {
      return;
    }

    void checkForRemoteUpdate();

    const intervalId = window.setInterval(() => {
      void checkForRemoteUpdate();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [artifactPath, artifact, lastLoadedUpdatedAt]);

  useEffect(() => {
    if (!artifact) {
      return;
    }

    const refreshOnAttention = () => {
      if (document.visibilityState === 'visible') {
        void checkForRemoteUpdate();
      }
    };

    window.addEventListener('focus', refreshOnAttention);
    document.addEventListener('visibilitychange', refreshOnAttention);

    return () => {
      window.removeEventListener('focus', refreshOnAttention);
      document.removeEventListener('visibilitychange', refreshOnAttention);
    };
  }, [artifact, resolvedArtifactPath, lastLoadedUpdatedAt]);

  useEffect(() => {
    setProposalCompareModeById({});
  }, [artifact?.relativePath, artifact?.updatedAt, activeProposalSet?.id, activeProposalSet?.createdAt]);

  useEffect(() => {
    if (!artifact || editMode) {
      return;
    }

    setEditBody(artifact.markdown);
    setEditBaseUpdatedAt(artifact.updatedAt);
  }, [artifact, editMode]);

  useEffect(() => {
    setProposalCompareModeById((current) => {
      const next: Record<string, 'original' | 'proposed'> = {};

      for (const item of pendingProposalItems) {
        next[item.id] = current[item.id] ?? 'proposed';
      }

      return next;
    });
  }, [pendingProposalItems]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    const { body, documentElement } = document;
    const scrollY = window.scrollY;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;
    const previousBodyOverflow = body.style.overflow;
    const previousHtmlOverflow = documentElement.style.overflow;

    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';
    documentElement.style.overflow = 'hidden';

    return () => {
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      body.style.overflow = previousBodyOverflow;
      documentElement.style.overflow = previousHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [menuOpen]);

  useEffect(() => {
    const syncViewportHeight = () => {
      const visualViewport = window.visualViewport;
      const viewportHeight = visualViewport?.height ?? window.innerHeight;
      const viewportOffsetTop = visualViewport?.offsetTop ?? 0;
      const thread = threadRef.current;
      const distanceFromBottom = thread
        ? Math.max(0, thread.scrollHeight - thread.scrollTop - thread.clientHeight)
        : 0;
      const previousMetrics = viewportMetricsRef.current;
      const composerHasFocus = document.activeElement === composerRef.current;
      const keyboardResize =
        composerHasFocus &&
        (viewportHeight < previousMetrics.height - 24 || viewportOffsetTop !== previousMetrics.offsetTop);

      document.documentElement.style.setProperty('--app-viewport-height', `${viewportHeight}px`);
      document.documentElement.style.setProperty('--app-viewport-offset-top', `${viewportOffsetTop}px`);
      viewportMetricsRef.current = {
        height: viewportHeight,
        offsetTop: viewportOffsetTop
      };

      if (!thread) {
        return;
      }

      window.requestAnimationFrame(() => {
        const currentThread = threadRef.current;

        if (!currentThread) {
          return;
        }

        if (keyboardResize) {
          scrollThreadToBottom();
          return;
        }

        const maxScrollTop = Math.max(0, currentThread.scrollHeight - currentThread.clientHeight);
        currentThread.scrollTop = Math.max(0, Math.min(maxScrollTop, maxScrollTop - distanceFromBottom));
      });
    };

    syncViewportHeight();

    const visualViewport = window.visualViewport;
    window.addEventListener('resize', syncViewportHeight);
    visualViewport?.addEventListener('resize', syncViewportHeight);
    visualViewport?.addEventListener('scroll', syncViewportHeight);

    return () => {
      window.removeEventListener('resize', syncViewportHeight);
      visualViewport?.removeEventListener('resize', syncViewportHeight);
      visualViewport?.removeEventListener('scroll', syncViewportHeight);
    };
  }, []);

  useEffect(() => {
    if (!railOpen) {
      return;
    }

    window.requestAnimationFrame(() => {
      scrollThreadToBottom();
    });
  }, [railOpen, displayedConversationComments.length, agentTurnPending]);

  function applyArtifactPayload(payload: ArtifactPayload | ProposalMutationResult) {
    if (!payload.artifact) {
      return;
    }

    const nextArtifact = payload.artifact;

    setArtifact(nextArtifact);
    setActiveProposalSet(payload.proposalSet ?? null);
    setProposalHistory(payload.proposalHistory ?? []);
    setLastLoadedUpdatedAt(nextArtifact.updatedAt);
    setHasRemoteUpdate(false);
    setDraftPath(nextArtifact.relativePath);
    setPendingLocalComment(null);
    setEditBaseUpdatedAt(nextArtifact.updatedAt);
    setEditNotice(null);
    setCreateMode(false);
    setCreateTitle('');
    setAttachedSectionId((current) => (current && nextArtifact.sections.some((section) => section.id === current) ? current : null));

    if (!editMode) {
      setEditBody(nextArtifact.markdown);
    }

    const params = new URLSearchParams(window.location.search);
    params.set('path', nextArtifact.relativePath);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
  }

  async function loadRecents() {
    try {
      const response = await fetch('/api/recents');
      const payload = await readJsonResponse<{ recents?: RecentArtifact[]; error?: string }>(response);

      if (!response.ok || !payload.recents) {
        throw new Error(payload.error ?? 'Failed to load recents.');
      }

      setRecentArtifacts(payload.recents);
    } catch {
      setRecentArtifacts([]);
    }
  }

  async function loadArtifact(nextPath: string, options?: { preserveCurrentOnError?: boolean }) {
    const preserveCurrentOnError = options?.preserveCurrentOnError ?? false;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artifact?path=${encodeURIComponent(nextPath)}`);
      const payload = await readJsonResponse<ArtifactPayload>(response);

      if (!response.ok || !payload.artifact) {
        throw new Error(payload.error ?? 'Failed to load document.');
      }

      applyArtifactPayload(payload);
      void loadRecents();
    } catch (caughtError) {
      if (!preserveCurrentOnError) {
        setArtifact(null);
        setActiveProposalSet(null);
        setProposalHistory([]);
        setLastLoadedUpdatedAt(null);
        setHasRemoteUpdate(false);
        setAttachedSectionId(null);
      }
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to load document.');
    } finally {
      setLoading(false);
    }
  }

  async function loadAgentAuthStatus(showLoading = true) {
    if (showLoading) {
      setAgentAuthLoading(true);
    }

    try {
      const response = await fetch('/api/agent/auth-status');
      const payload = await readJsonResponse<{ auth?: AgentAuthStatus; error?: string }>(response);

      if (!response.ok || !payload.auth) {
        throw new Error(payload.error ?? 'Failed to load agent auth status.');
      }

      setAgentAuth(payload.auth);
    } catch (caughtError) {
      setAgentAuth({
        state: 'error',
        provider: 'openai-codex',
        message: caughtError instanceof Error ? caughtError.message : 'Failed to load agent auth status.'
      });
    } finally {
      if (showLoading) {
        setAgentAuthLoading(false);
      }
    }
  }

  async function checkForRemoteUpdate() {
    if (!resolvedArtifactPath || !lastLoadedUpdatedAt) {
      return;
    }

    try {
      const response = await fetch(`/api/artifact/meta?path=${encodeURIComponent(resolvedArtifactPath)}`);
      const payload = await readJsonResponse<{ updatedAt?: string; error?: string }>(response);

      if (!response.ok || !payload.updatedAt) {
        throw new Error(payload.error ?? 'Failed to inspect document.');
      }

      setHasRemoteUpdate(payload.updatedAt !== lastLoadedUpdatedAt);
    } catch {
      setHasRemoteUpdate(false);
    }
  }

  function attachSection(sectionId: string | null) {
    setAttachedSectionId(sectionId);
  }

  function handleSectionHeadingClick(sectionId: string, event: MouseEvent<HTMLElement>) {
    if (interactionLocked || editMode) {
      return;
    }

    const target = event.target;

    if (!(target instanceof Element) || !target.closest('h1, h2, h3, h4, h5, h6')) {
      return;
    }

    attachSection(attachedSectionId === sectionId ? null : sectionId);
  }

  function handleOpenArtifact(nextPath: string) {
    if (interactionLocked || editMode) {
      return;
    }

    const normalizedPath = nextPath.trim() || DEFAULT_ARTIFACT_PATH;

    setDraftPath(normalizedPath);
    setMenuOpen(false);
    setRailOpen(false);

    if (normalizedPath === artifactPath) {
      void loadArtifact(normalizedPath, { preserveCurrentOnError: true });
      return;
    }

    setArtifact(null);
    setActiveProposalSet(null);
    setProposalHistory([]);
    setLastLoadedUpdatedAt(null);
    setHasRemoteUpdate(false);
    setPendingLocalComment(null);
    setAttachedSectionId(null);
    setComposerBody('');
    setArtifactPath(normalizedPath);
  }

  async function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = composerBody.trim();

    if (!body || interactionLocked || editMode) {
      return;
    }

    const optimisticComment: Comment = {
      id: `local-${Date.now()}`,
      authorType: 'human',
      body,
      createdAt: new Date().toISOString(),
      sectionId: attachedSectionId
    };

    setSubmitting(true);
    setAgentTurnPending(agentAuth?.state === 'connected');
    setError(null);
    setPendingLocalComment(optimisticComment);
    setComposerBody('');

    try {
      if (agentAuth?.state === 'connected') {
        const response = await fetch('/api/agent/turn', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            path: resolvedArtifactPath,
            focusedSectionId: attachedSectionId,
            prompt: body
          })
        });
        const payload = await readJsonResponse<AgentTurnPayload>(response);

        if (!response.ok || !payload.artifact) {
          throw new Error(payload.error ?? 'Failed to run the agent turn.');
        }

        applyArtifactPayload(payload);
      } else {
        const response = await fetch('/api/comments', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            path: resolvedArtifactPath,
            sectionId: attachedSectionId,
            body
          })
        });
        const payload = await readJsonResponse<ArtifactPayload>(response);

        if (!response.ok || !payload.artifact) {
          throw new Error(payload.error ?? 'Failed to save comment.');
        }

        applyArtifactPayload(payload);
      }

      void loadRecents();
    } catch (caughtError) {
      setPendingLocalComment(null);
      setComposerBody(body);
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save comment.');
    } finally {
      setSubmitting(false);
      setAgentTurnPending(false);
    }
  }

  async function handleReloadDocument() {
    if (interactionLocked) {
      return;
    }

    if (editMode && hasUnsavedEditChanges) {
      setError('Finish or cancel the current manual edit before reloading the document.');
      return;
    }

    await loadArtifact(resolvedArtifactPath, { preserveCurrentOnError: true });
  }

  function handleOpenCreateDocument() {
    if (interactionLocked || editMode) {
      return;
    }

    setCreateMode(true);
    setCreateTitle('');
    setError(null);
  }

  function handleCancelCreateDocument() {
    if (creatingDocument) {
      return;
    }

    setCreateMode(false);
    setCreateTitle('');
  }

  async function handleCreateDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = createTitle.trim();

    if (!title || interactionLocked || editMode) {
      return;
    }

    setCreatingDocument(true);
    setError(null);

    try {
      const response = await fetch('/api/artifact/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title
        })
      });
      const payload = await readJsonResponse<ArtifactPayload>(response);

      if (!response.ok || !payload.artifact) {
        throw new Error(payload.error ?? 'Failed to create document.');
      }

      applyArtifactPayload(payload);
      setArtifactPath(payload.artifact.relativePath);
      setMenuOpen(false);
      setRailOpen(false);
      void loadRecents();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create document.');
    } finally {
      setCreatingDocument(false);
    }
  }

  function handleEnterEditMode() {
    if (!artifact || interactionLocked) {
      return;
    }

    if (hasPendingProposal) {
      setError('Resolve the pending proposal before entering manual edit mode.');
      return;
    }

    setEditBody(artifact.markdown);
    setEditBaseUpdatedAt(artifact.updatedAt);
    setEditNotice(null);
    setEditMode(true);
    setRailOpen(false);
    setMenuOpen(false);
  }

  function handleCancelEditMode() {
    if (!artifact || savingEdit) {
      return;
    }

    setEditBody(artifact.markdown);
    setEditBaseUpdatedAt(artifact.updatedAt);
    setEditMode(false);
    setEditNotice(null);
  }

  async function handleSaveEdit() {
    if (!artifact || !editBaseUpdatedAt || interactionLocked) {
      return;
    }

    if (!hasUnsavedEditChanges) {
      setEditMode(false);
      setEditNotice(null);
      return;
    }

    setSavingEdit(true);
    setError(null);
    setEditNotice(null);

    try {
      const response = await fetch('/api/artifact/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: resolvedArtifactPath,
          markdown: editBody,
          baseUpdatedAt: editBaseUpdatedAt
        })
      });
      const payload = await readJsonResponse<(ProposalMutationResult & { error?: string })>(response);

      if (!response.ok || !payload.artifact) {
        throw new Error(payload.error ?? 'Failed to save edit.');
      }

      applyArtifactPayload(payload);
      setEditMode(false);
      setEditBody(payload.artifact.markdown);
      setEditBaseUpdatedAt(payload.artifact.updatedAt);
      setEditNotice('Saved to document.');
      void loadRecents();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save edit.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleConnectAgent() {
    if (agentAuthLoading || interactionLocked) {
      return;
    }

    setError(null);

    try {
      const response = await fetch('/api/agent/connect', {
        method: 'POST'
      });
      const payload = await readJsonResponse<{ auth?: AgentAuthStatus; error?: string }>(response);

      if (!response.ok || !payload.auth) {
        throw new Error(payload.error ?? 'Failed to start ChatGPT/Codex login.');
      }

      setAgentAuth(payload.auth);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to start ChatGPT/Codex login.');
    }
  }

  async function handleDisconnectAgent() {
    if (agentAuthLoading || interactionLocked) {
      return;
    }

    setError(null);

    try {
      const response = await fetch('/api/agent/disconnect', {
        method: 'POST'
      });
      const payload = await readJsonResponse<{ auth?: AgentAuthStatus; error?: string }>(response);

      if (!response.ok || !payload.auth) {
        throw new Error(payload.error ?? 'Failed to disconnect ChatGPT/Codex.');
      }

      setAgentAuth(payload.auth);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to disconnect ChatGPT/Codex.');
    }
  }

  async function handleProposalMutation(endpoint: string) {
    if (interactionLocked || editMode) {
      return;
    }

    if (hasStalePendingProposals && endpoint.includes('/accept')) {
      setError('Reload the document before accepting a stale proposal.');
      return;
    }

    setError(null);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          path: resolvedArtifactPath
        })
      });
      const payload = await readJsonResponse<(ProposalMutationResult & { error?: string })>(response);

      if (!response.ok || !payload.artifact) {
        throw new Error(payload.error ?? 'Failed to update the proposal.');
      }

      applyArtifactPayload(payload);
      void loadRecents();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Failed to update the proposal.';

      if (message.includes('no longer matches the current document')) {
        setHasRemoteUpdate(true);
      }

      setError(message);
    }
  }

  function handleFocusProposalSection(sectionId: string | null) {
    if (!sectionId || interactionLocked || editMode) {
      return;
    }

    attachSection(sectionId);

    if (window.innerWidth < 1080) {
      setRailOpen(false);
    }

    window.requestAnimationFrame(() => {
      const sectionElement = document.getElementById(sectionId);
      sectionElement?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    });
  }

  function handleOpenProposalInDocument() {
    handleFocusProposalSection(activeProposalPrimarySectionId);
  }

  function handleCycleProposalInDocument() {
    if (!reviewStateCanCycle || interactionLocked || editMode) {
      return;
    }

    const nextIndex = activeProposalReviewIndex >= 0
      ? (activeProposalReviewIndex + 1) % activeProposalTargetSectionIds.length
      : 0;

    handleFocusProposalSection(activeProposalTargetSectionIds[nextIndex] ?? null);
  }

  function handleDismissPanels() {
    if (interactionLocked || editMode) {
      return;
    }

    setMenuOpen(false);
    setRailOpen(false);
  }

  function preventPanelDismiss(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  function handleComposerFocus() {
    startComposerFocusFollow();
  }

  function handleComposerBlur() {
    stopComposerFocusFollow();
  }

  function handleOverlayPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    handleDismissPanels();
  }

  function handleReaderSurfacePointerDown(event: PointerEvent<HTMLElement>) {
    if (interactionLocked || editMode) {
      return;
    }

    if (!railOpen) {
      return;
    }

    const target = event.target;

    if (target instanceof Element && target.closest('.discussion-rail')) {
      return;
    }

    setRailOpen(false);
  }

  function renderProposalTimelineMarker(proposalSet: ProposalSetRecord) {
    const targetSectionId = proposalSet.focusedSectionId ?? proposalSet.items[0]?.sectionId ?? null;

    const eventState = proposalSet.status === 'dismissed'
      ? 'rejected'
      : proposalSet.status === 'partially_applied'
        ? 'partial'
        : proposalSet.status === 'applied'
          ? 'accepted'
          : 'pending';
    const eventLabel = eventState === 'pending'
      ? proposalSet.version > 1
        ? 'Proposal refined'
        : 'Proposal suggested'
      : eventState === 'rejected'
        ? 'Proposal rejected'
        : eventState === 'partial'
          ? 'Proposal partially accepted'
          : 'Proposal accepted';

    const markerNote = targetSectionId ? (
      <button
        className="thread-event-note thread-event-note-clickable"
        type="button"
        disabled={interactionLocked}
        onClick={() => handleFocusProposalSection(targetSectionId)}
      >
        {eventLabel}
      </button>
    ) : (
      <p className="thread-event-note">{eventLabel}</p>
    );

    return (
      <div className="thread-event-row" key={proposalSet.id}>
        <div className="thread-event-log">
          {markerNote}
        </div>
      </div>
    );
  }

  const showAgentConnectCard =
    agentAuthLoading ||
    !agentAuth ||
    agentAuth.state === 'connecting' ||
    agentAuth.state === 'expired' ||
    agentAuth.state === 'error' ||
    agentAuth.state === 'not_connected';

  return (
    <main className={`app-shell${menuOpen ? ' app-shell-menu-open' : ''}`}>
      <div
        className={`shell-overlay${showOverlay ? ' shell-overlay-open' : ''}${interactiveOverlay ? ' shell-overlay-interactive' : ''}`}
        onPointerDown={interactiveOverlay ? handleOverlayPointerDown : undefined}
        aria-hidden={showOverlay ? 'false' : 'true'}
      />

      <aside className={`workspace-menu${menuOpen ? ' workspace-menu-open' : ''}`} aria-label="Workshop navigation">
        <div
          className="workspace-menu-panel"
          role="region"
          aria-label="Workshop menu"
          onPointerDown={preventPanelDismiss}
          onClick={preventPanelDismiss}
        >
          <div className="workspace-menu-header">
            <div className="workspace-brand-lockup">
              <div className="workspace-logo-mark" aria-hidden="true">W</div>
              <div className="workspace-brand-copy">
                <p className="workspace-brand-name">Workshop</p>
              </div>
            </div>
            <button
              className="workspace-menu-close"
              type="button"
              disabled={interactionLocked}
              onClick={() => setMenuOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
          </div>

          <div className="workspace-menu-section workspace-menu-agent">
            <div className="workspace-menu-section-header">
              <p className="section-label workspace-menu-label">Agent</p>
            </div>

            {showAgentConnectCard ? (
              <div className="agent-status-card workspace-menu-agent-card">
                <div className="agent-row agent-row-expanded" role="group" aria-label="Agent connection">
                  <div className="agent-row-main">
                    <span
                      className={`discussion-rail-status${agentAuth?.state === 'connecting' ? ' discussion-rail-status-disconnected' : ''}`}
                    >
                      {renderDrawerAgentStatusLabel(agentAuth, agentAuthLoading)}
                    </span>
                    <span className="agent-row-provider">Codex</span>
                  </div>
                  {agentAuth?.state !== 'connecting' ? (
                    <button
                      className="secondary-button compact-button discussion-header-button"
                      type="button"
                      onClick={() => void handleConnectAgent()}
                      disabled={agentAuthLoading || interactionLocked}
                    >
                      {renderDrawerAgentActionLabel(agentAuth, agentAuthLoading)}
                    </button>
                  ) : null}
                </div>

                {agentAuth?.state === 'connecting' ? (
                  <div className="agent-connect-flow">
                    <p className="agent-connect-copy">
                      Open{' '}
                      <a href={agentAuth.authUrl} target="_blank" rel="noreferrer">
                        {agentAuth.authUrl ?? 'the device login page'}
                      </a>{' '}
                      and enter:
                    </p>
                    <p className="agent-device-code">{agentAuth.code ?? 'Waiting for code…'}</p>
                    <p className="context-subtle">Workshop will notice once the login finishes.</p>
                  </div>
                ) : agentAuth?.message && !agentAuthLoading ? (
                  <p className="agent-connect-copy context-subtle">{agentAuth.message}</p>
                ) : null}
              </div>
            ) : (
              <div className="agent-row agent-row-compact" role="group" aria-label="Agent connection">
                <div className="agent-row-main">
                  <span className="discussion-rail-status discussion-rail-status-connected">
                    {renderDrawerAgentStatusLabel(agentAuth, agentAuthLoading)}
                  </span>
                  <span className="agent-row-provider">{agentAuth?.accountLabel ?? 'Codex'}</span>
                </div>
                <button
                  className="secondary-button compact-button discussion-header-button"
                  type="button"
                  onClick={() => void handleDisconnectAgent()}
                  disabled={agentAuthLoading || interactionLocked}
                >
                  {renderDrawerAgentActionLabel(agentAuth, agentAuthLoading)}
                </button>
              </div>
            )}
          </div>

          <div className="workspace-menu-section workspace-menu-recents">
            <div className="workspace-menu-section-header">
              <p className="section-label workspace-menu-label">Recents</p>
              {!createMode ? (
                <button
                  className="secondary-button compact-button workspace-menu-create-button"
                  type="button"
                  disabled={interactionLocked}
                  onClick={handleOpenCreateDocument}
                >
                  New document
                </button>
              ) : null}
            </div>

            {createMode ? (
              <form className="workspace-create-form" onSubmit={(event) => void handleCreateDocument(event)}>
                <input
                  className="path-input workspace-create-input"
                  type="text"
                  value={createTitle}
                  disabled={interactionLocked}
                  onChange={(event) => setCreateTitle(event.target.value)}
                  placeholder="Document title"
                  autoFocus
                />
                <div className="workspace-create-actions">
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    disabled={creatingDocument}
                    onClick={handleCancelCreateDocument}
                  >
                    Cancel
                  </button>
                  <button
                    className="primary-button compact-button workspace-create-submit"
                    type="submit"
                    disabled={!createTitle.trim() || interactionLocked}
                  >
                    {creatingDocument ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            ) : null}

            {displayedRecentArtifacts.length > 0 ? (
              <div className="recent-list" role="list">
                {displayedRecentArtifacts.map((recent) => {
                  return (
                    <button
                      key={recent.relativePath}
                      className="recent-item"
                      data-active={recent.relativePath === resolvedArtifactPath ? 'true' : 'false'}
                      type="button"
                      disabled={interactionLocked}
                      onClick={() => handleOpenArtifact(recent.relativePath)}
                      aria-current={recent.relativePath === resolvedArtifactPath ? 'page' : undefined}
                    >
                      <span className="recent-item-topline">
                        <span className="recent-item-title">{recent.title}</span>
                      </span>
                      <span className="recent-item-path">{recent.relativePath}</span>
                      <span className="recent-item-meta">
                        <span>{formatRecentActivity(recent)}</span>
                        <span>{recent.commentCount} {recent.commentCount === 1 ? 'message' : 'messages'}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="empty-thread workspace-menu-empty">
                Create a new document or open another one and it will show up here for quick switching.
              </p>
            )}
          </div>
        </div>
      </aside>

      <div className="app-frame">
        {!artifact ? (
          <section className="app-toolbar" aria-label="Document controls">
            <div className="toolbar-header-row">
              <button
                className="secondary-button compact-button icon-button menu-trigger"
                type="button"
                disabled={interactionLocked}
                onClick={() => setMenuOpen(true)}
                aria-label="Open menu"
              >
                <span className="menu-trigger-bars" aria-hidden="true">
                  <span />
                  <span />
                </span>
              </button>
            </div>
            <div className="toolbar-copy">
              <p className="toolbar-title">Open document</p>
              <p className="toolbar-meta">A quieter, phone-first review surface for one document and one running discussion.</p>
              <div className="reader-meta-pills toolbar-meta-pills">
                <span className="meta-pill">{summarizeAgentStatus(agentAuth, agentAuthLoading)}</span>
              </div>
            </div>
            <form
              className="path-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleOpenArtifact(draftPath);
              }}
            >
              <div className="path-row">
                <input
                  className="path-input"
                  type="text"
                  disabled={interactionLocked}
                  value={draftPath}
                  onChange={(event) => setDraftPath(event.target.value)}
                  placeholder={DEFAULT_ARTIFACT_PATH}
                />
                <button className="secondary-button" type="submit" disabled={interactionLocked}>
                  {loading ? 'Opening…' : 'Open'}
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {error ? <p className="error-banner" role="alert">{error}</p> : null}

        {loading && !artifact ? (
          <section className="artifact-card" role="status" aria-live="polite" aria-busy="true">
            <p className="artifact-kicker">Loading document</p>
            <h2>Fetching the latest document and discussion...</h2>
          </section>
        ) : null}

        {artifact ? (
          <>
            <header
              className={`reader-bar${editMode ? ' reader-bar-editing' : ''}`}
              onPointerDown={handleReaderSurfacePointerDown}
            >
              <div className="reader-bar-row">
                <div className="reader-bar-leading">
                  <button
                    className="secondary-button compact-button icon-button menu-trigger"
                    type="button"
                    disabled={interactionLocked}
                    onClick={() => {
                      setRailOpen(false);
                      setMenuOpen(true);
                    }}
                    aria-label="Open menu"
                  >
                    <span className="menu-trigger-bars" aria-hidden="true">
                      <span />
                      <span />
                    </span>
                  </button>
                  <div className="reader-meta">
                    <p className="reader-title">{artifact.title}</p>
                  </div>
                </div>
                <div className="reader-actions" role="group" aria-label="Document actions">
                  {editMode ? (
                    <>
                      <button
                        className="secondary-button compact-button proposal-review-button reader-rail-button"
                        type="button"
                        disabled={savingEdit}
                        onClick={handleCancelEditMode}
                      >
                        Cancel
                      </button>
                      <button
                        className="primary-button compact-button action-primary-button proposal-review-button reader-rail-button"
                        type="button"
                        disabled={interactionLocked || hasRemoteUpdate}
                        title={hasRemoteUpdate ? 'Reload the document before saving your edit.' : undefined}
                        onClick={() => void handleSaveEdit()}
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary-button compact-button reader-rail-button"
                      type="button"
                      disabled={interactionLocked || hasPendingProposal}
                      title={hasPendingProposal ? 'Accept or reject the pending proposal before editing directly.' : undefined}
                      onClick={handleEnterEditMode}
                    >
                      Edit
                    </button>
                  )}
                  {!editMode ? (
                    <button
                      className="secondary-button compact-button reader-rail-button"
                      type="button"
                      disabled={interactionLocked}
                      onClick={() => {
                        setMenuOpen(false);
                        setRailOpen(true);
                      }}
                    >
                      Discuss
                    </button>
                  ) : null}
                </div>
              </div>
              {activeProposalSet || hasRemoteUpdate || agentTurnPending || loading || editMode || editNotice ? (
                <ReaderStatusBanner
                  reviewStateLabel={reviewStateLabel}
                  reviewStateCanCycle={reviewStateCanCycle}
                  reviewStateCycleLabel={reviewStateCycleLabel}
                  reviewTargetCount={activeProposalTargetSectionIds.length}
                  interactionLocked={interactionLocked}
                  editMode={editMode}
                  loading={loading}
                  agentTurnPending={agentTurnPending}
                  pendingTurnMessage={pendingTurnMessage}
                  hasUnsavedEditChanges={hasUnsavedEditChanges}
                  editNotice={editNotice}
                  hasRemoteUpdate={hasRemoteUpdate}
                  hasStalePendingProposals={hasStalePendingProposals}
                  onCycleProposal={handleCycleProposalInDocument}
                  onReloadDocument={handleReloadDocument}
                />
              ) : null}
            </header>

            <div
              className={`reader-layout${railOpen ? ' reader-layout-with-rail' : ''}`}
              onPointerDown={handleReaderSurfacePointerDown}
            >
              <section className="artifact-card artifact-reader" role="region" aria-label="Document workspace">
                {editMode ? (
                  <div
                    className="manual-edit-shell"
                    aria-busy={savingEdit ? 'true' : 'false'}
                    role="region"
                    aria-label="Manual document edit"
                  >
                    <div className="manual-edit-meta">
                      <p className="proposal-kicker">Edit mode</p>
                      <p className="context-subtle">
                        Directly edit the real Markdown source, then save it as canonical document state.
                      </p>
                    </div>
                    <textarea
                      className="manual-edit-input"
                      value={editBody}
                      onChange={(event) => setEditBody(event.target.value)}
                      placeholder="Edit the document markdown..."
                      disabled={savingEdit}
                      aria-label="Document markdown editor"
                      spellCheck={false}
                    />
                  </div>
                ) : (
                  <div
                    className="section-list"
                    role="region"
                    aria-label="Document content"
                    data-busy={interactionLocked ? 'true' : 'false'}
                    aria-busy={interactionLocked ? 'true' : 'false'}
                  >
                    {isFreshDocument ? (
                      <div className="document-empty-state" role="status" aria-live="polite">
                        <p className="proposal-kicker">New document</p>
                        <h2 className="document-empty-title">Start with a first line or ask for a first draft.</h2>
                        <p className="context-subtle document-empty-copy">
                          This page is ready. Write directly in edit mode, or open the discussion rail and ask the agent to sketch an outline.
                        </p>
                        <div className="document-empty-actions">
                          <button
                            className="primary-button compact-button action-primary-button"
                            type="button"
                            disabled={interactionLocked || hasPendingProposal}
                            title={hasPendingProposal ? 'Accept or reject the pending proposal before editing directly.' : undefined}
                            onClick={handleEnterEditMode}
                          >
                            Start writing
                          </button>
                          <button
                            className="secondary-button compact-button"
                            type="button"
                            disabled={interactionLocked}
                            onClick={() => {
                              setMenuOpen(false);
                              setRailOpen(true);
                            }}
                          >
                            Ask the agent
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {artifact.sections.map((section) => {
                      const proposalItem = proposalItemsBySection.get(section.id) ?? null;
                      const proposalCompareMode = proposalItem ? proposalCompareModeById[proposalItem.id] ?? 'proposed' : null;
                      const proposalRenderedHtml = proposalItem
                        ? marked.parse(
                            proposalCompareMode === 'original' ? proposalItem.beforeMarkdown : proposalItem.afterMarkdown
                          ) as string
                        : null;

                      return (
                        <article
                          className={`section-card${proposalItem ? ' section-card-with-proposal' : ''}`}
                          data-attached={attachedSectionId === section.id ? 'true' : 'false'}
                          data-pending={proposalItem ? 'true' : 'false'}
                          id={section.id}
                          key={section.id}
                          onClick={(event) => handleSectionHeadingClick(section.id, event)}
                        >
                          {!proposalItem ? (
                            <div
                              className="section-rendered"
                              dangerouslySetInnerHTML={{ __html: section.renderedHtml }}
                            />
                          ) : (
                            <ProposalInlineCard
                              proposalItemId={proposalItem.id}
                              proposalSetId={activeProposalSet?.id ?? null}
                              proposalCompareMode={proposalCompareMode ?? 'proposed'}
                              proposalRenderedHtml={proposalRenderedHtml ?? ''}
                              interactionLocked={interactionLocked}
                              hasStalePendingProposals={hasStalePendingProposals}
                              loading={loading}
                              onSetCompareMode={(mode) => setProposalCompareModeById((current) => ({ ...current, [proposalItem.id]: mode }))}
                              onReject={() => handleProposalMutation(`/api/proposals/${activeProposalSet?.id}/items/${proposalItem.id}/dismiss`)}
                              onAccept={() => handleProposalMutation(`/api/proposals/${activeProposalSet?.id}/items/${proposalItem.id}/accept`)}
                              onReloadDocument={handleReloadDocument}
                            />
                          )}

                        </article>
                      );
                    })}
                  </div>
                )}
              </section>

              <aside
                className={`discussion-rail${railOpen ? ' discussion-rail-open' : ''}`}
                aria-label="Discussion"
                onPointerDown={preventPanelDismiss}
                onClick={preventPanelDismiss}
              >
                <div className="discussion-rail-panel" role="region" aria-label="Discussion panel">
                  <div className="discussion-rail-header">
                    <div className="discussion-rail-header-main">
                      <span
                        className={`discussion-rail-status${agentAuth?.state === 'connected' ? ' discussion-rail-status-connected' : ' discussion-rail-status-disconnected'}`}
                      >
                        {renderRailAgentHint(agentAuth, agentAuthLoading)}
                      </span>
                    </div>
                    <button
                      className="workspace-menu-close"
                      type="button"
                      onClick={() => setRailOpen(false)}
                      aria-label="Close discussion"
                    >
                      ×
                    </button>
                  </div>

                  <div
                    className="discussion-thread"
                    ref={threadRef}
                    role="region"
                    aria-label="Discussion thread"
                    aria-busy={interactionLocked ? 'true' : 'false'}
                  >
                    {displayedConversationComments.length > 0 || agentTurnPending || proposalHistory.length > 0 ? (
                      <div className="thread-list">
                        {displayedConversationComments.map((comment) => {
                          const commentSection = comment.sectionId ? sectionById.get(comment.sectionId) ?? null : null;
                          const isActiveProposalAnchor = activeProposalAnchorCommentId === comment.id;
                          const anchoredProposalTimeline = proposalTimelineByAnchorCommentId.get(comment.id) ?? [];
                          const proposalContextLabel = isActiveProposalAnchor
                            ? activeProposalContextLabel
                            : commentSection?.headingText ?? null;
                          const jumpLabel = activeProposalSpansMultipleSections ? 'Jump to changes' : 'Jump to change';

                          return (
                            <div key={comment.id}>
                              <div className="comment-row" data-author={comment.authorType}>
                                <div
                                  className={`comment-thread${isActiveProposalAnchor ? ' comment-thread-active-proposal' : ''}`}
                                  data-author={comment.authorType}
                                  data-active-proposal={isActiveProposalAnchor ? 'true' : 'false'}
                                >
                                  {proposalContextLabel || isActiveProposalAnchor ? (
                                    <div className="comment-thread-header">
                                      {proposalContextLabel ? <p className="comment-context comment-context-tight">{proposalContextLabel}</p> : <span />}
                                      {isActiveProposalAnchor ? (
                                        <button
                                          className="text-button text-button-muted comment-jump-link"
                                          type="button"
                                          disabled={interactionLocked}
                                          onClick={handleOpenProposalInDocument}
                                        >
                                          {jumpLabel}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <p>{comment.body}</p>
                                  {isActiveProposalAnchor && activeProposalSet ? (
                                    <ProposalThreadFooter
                                      activeProposalTargetSummary={activeProposalTargetSummary}
                                      interactionLocked={interactionLocked}
                                      hasStalePendingProposals={hasStalePendingProposals}
                                      loading={loading}
                                      onReject={() => handleProposalMutation(`/api/proposals/${activeProposalSet.id}/dismiss`)}
                                      onAccept={() => handleProposalMutation(`/api/proposals/${activeProposalSet.id}/accept-all`)}
                                      onReloadDocument={handleReloadDocument}
                                    />
                                  ) : null}
                                </div>
                              </div>
                              {anchoredProposalTimeline.map((proposalSet) => renderProposalTimelineMarker(proposalSet))}
                            </div>
                          );
                        })}
                        {unattachedProposalTimeline.map((proposalSet) => renderProposalTimelineMarker(proposalSet))}
                        {agentTurnPending ? (
                          <div className="comment-row" data-author="agent">
                            <div className="comment-thread" data-author="agent">
                              <p role="status" aria-live="polite">
                                {pendingTurnMessage}
                                <span className="pending-ellipsis" aria-hidden="true">
                                  <span>.</span>
                                  <span>.</span>
                                  <span>.</span>
                                </span>
                              </p>
                            </div>
                          </div>
                        ) : null}
                        <div aria-hidden="true" ref={threadEndRef} />
                      </div>
                    ) : (
                      <p className="empty-thread">
                        {agentAuth?.state === 'connected'
                          ? 'Fresh bench. Start with the big move or a tiny fix.'
                          : 'Fresh bench. Connect the workshop flow from the menu if needed.'}
                      </p>
                    )}
                  </div>

                  <form
                    className="discussion-composer"
                    onSubmit={(event) => void handleComposerSubmit(event)}
                    ref={composerFrameRef}
                    role="group"
                    aria-label="Discussion composer"
                    aria-busy={interactionLocked ? 'true' : 'false'}
                  >
                    {hasRemoteUpdate ? (
                      <div className="discussion-status-inline" role="status" aria-live="polite">
                        <span className={`status-pill${hasStalePendingProposals ? ' status-pill-warning' : ''}`}>
                          {hasStalePendingProposals ? 'Reload required' : 'Updated'}
                        </span>
                        <span className="context-subtle">
                          {hasStalePendingProposals
                            ? 'A newer document version is available. Reload before accepting proposals.'
                            : 'A newer document version is available.'}
                        </span>
                        <button className="text-button" type="button" disabled={interactionLocked} onClick={() => void handleReloadDocument()}>
                          {loading ? 'Reloading…' : 'Reload'}
                        </button>
                      </div>
                    ) : null}
                    {error ? <p className="rail-error-inline" role="alert">{error}</p> : null}
                    <div className="composer-row">
                      <textarea
                        ref={composerRef}
                        className="composer-input"
                        rows={1}
                        value={composerBody}
                        onChange={(event) => setComposerBody(event.target.value)}
                        onFocus={handleComposerFocus}
                        onBlur={handleComposerBlur}
                        disabled={interactionLocked}
                        placeholder={composerPlaceholder}
                      />
                      <button
                        className="primary-button composer-submit"
                        type="submit"
                        disabled={interactionLocked}
                        aria-label={interactionLocked ? 'Sending message' : 'Send message'}
                      >
                        {interactionLocked ? (
                          <span className="pending-ellipsis pending-ellipsis-compact" aria-hidden="true">
                            <span>.</span>
                            <span>.</span>
                            <span>.</span>
                          </span>
                        ) : '➤'}
                      </button>
                    </div>
                  </form>
                </div>
              </aside>
            </div>
          </>
        ) : null}
      </div>
    </main>
  );
}
