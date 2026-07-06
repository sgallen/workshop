import { FormEvent, MouseEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare } from '@fortawesome/free-regular-svg-icons';
import { faArrowUp, faCircleNotch } from '@fortawesome/free-solid-svg-icons';
import { buildDisplayedRecents } from '../core/recents/build-displayed-recents';
import type { Artifact, Comment, ProposalMutationResult, ProposalSetRecord, RecentArtifact, RevisionRecord } from '../core/types';
import { formatArtifactTimestamp, formatRecentActivity } from './lib/formatting';
import { readJsonResponse } from './lib/read-json-response';
import { AgentConnectionStatus, type AgentConnectionState } from './components/AgentConnectionStatus';
import { ProposalInlineCard } from './components/ProposalInlineCard';
import { ProposalThreadFooter } from './components/ProposalThreadFooter';
import { ReaderStatusBanner } from './components/ReaderStatusBanner';
import {
  summarizeAgentStatus,
  type AgentAuthStatus
} from './web/agent-auth';

const DEFAULT_ARTIFACT_PATH = 'docs/project-brief.md';
const COMPOSER_DRAFT_STORAGE_PREFIX = 'workshop:composer-draft:';
const DRAFT_ARTIFACT_PATH = '__draft__/new-document.md';
const DRAFT_ARTIFACT_TITLE = 'New document';
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

function buildDraftSeedMarkdown(title: string): string {
  return `# ${title.trim()}\n`;
}

function createDraftArtifact(): Artifact {
  return {
    title: DRAFT_ARTIFACT_TITLE,
    relativePath: DRAFT_ARTIFACT_PATH,
    absolutePath: DRAFT_ARTIFACT_PATH,
    updatedAt: new Date(0).toISOString(),
    markdown: '',
    renderedHtml: '',
    comments: [],
    sections: []
  };
}

function getShortSentence(text: string | null | undefined): string | null {
  const normalized = text?.trim();

  if (!normalized) {
    return null;
  }

  const firstSentenceMatch = normalized.match(/^(.+?[.!?])(?:\s|$)/);
  const firstSentence = firstSentenceMatch ? firstSentenceMatch[1].trim() : normalized;

  if (firstSentence.length <= 160) {
    return firstSentence;
  }

  const sliced = firstSentence.slice(0, 157).trimEnd();
  return `${sliced}...`;
}

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

function describeRevisionSource(source: RevisionRecord['source']): string {
  switch (source) {
    case 'proposal_item_accept':
      return 'Accepted change';
    case 'proposal_set_accept_all':
      return 'Accepted all';
    case 'restore_revision':
      return 'Restored revision';
    case 'manual_save':
      return 'Manual save';
    default:
      return 'Revision';
  }
}

function getRevisionSourceBadgeLabel(source: RevisionRecord['source']): string {
  switch (source) {
    case 'proposal_item_accept':
      return 'Accept';
    case 'proposal_set_accept_all':
      return 'Accept all';
    case 'restore_revision':
      return 'Restore';
    case 'manual_save':
      return 'Manual';
    default:
      return 'Revision';
  }
}

function WorkshopWordmark() {
  return (
    <p className="workspace-brand-name" aria-label="Workshop">
      Workshop
    </p>
  );
}

export function App() {
  const initialPath = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('path') ?? DEFAULT_ARTIFACT_PATH;
  }, []);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerFrameRef = useRef<HTMLFormElement | null>(null);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const threadEndRef = useRef<HTMLDivElement | null>(null);
  const draftTitleInputRef = useRef<HTMLInputElement | null>(null);
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
  const [revisions, setRevisions] = useState<RevisionRecord[]>([]);
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
  const [remoteUpdatedAt, setRemoteUpdatedAt] = useState<string | null>(null);
  const [lastLoadedUpdatedAt, setLastLoadedUpdatedAt] = useState<string | null>(null);
  const [agentAuth, setAgentAuth] = useState<AgentAuthStatus | null>(null);
  const [agentAuthLoading, setAgentAuthLoading] = useState(true);
  const [agentManageOpen, setAgentManageOpen] = useState(false);
  const [pendingLocalComment, setPendingLocalComment] = useState<Comment | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editBody, setEditBody] = useState('');
  const [editBaseUpdatedAt, setEditBaseUpdatedAt] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editNotice, setEditNotice] = useState<string | null>(null);
  const [draftDocumentTitle, setDraftDocumentTitle] = useState('');
  const [creatingDocument, setCreatingDocument] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [highlightedRevisionId, setHighlightedRevisionId] = useState<string | null>(null);

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
  const isDraftDocument = artifact?.relativePath === DRAFT_ARTIFACT_PATH;
  const resolvedArtifactPath = isDraftDocument ? null : artifact?.relativePath ?? artifactPath;
  const showOverlay = menuOpen;
  const interactiveOverlay = menuOpen;
  const displayedRecentArtifacts = useMemo(() => {
    return buildDisplayedRecents(isDraftDocument ? null : artifact, recentArtifacts, conversationComments.length, DEMO_RECENT_CANDIDATES);
  }, [artifact, conversationComments.length, isDraftDocument, recentArtifacts]);
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
  const remoteUpdateLabel = hasRemoteUpdate && remoteUpdatedAt
    ? `Newer version saved ${formatArtifactTimestamp(remoteUpdatedAt)}`
    : null;
  const historyActionNotice = hasPendingProposal
    ? 'Resolve the pending proposal before changing document history.'
    : hasRemoteUpdate
      ? 'Reload the document before using undo or restore.'
      : revisions.length < 2
        ? 'Undo becomes available after there is an earlier saved revision to return to.'
        : null;
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
  const activeProposalPrimarySectionId =
    activeProposalTargetSectionIds[0] ?? activeProposalSet?.focusedSectionId ?? pendingProposalItems[0]?.sectionId ?? null;
  const activeProposalSpansMultipleSections = activeProposalTargetSectionIds.length > 1;
  const activeProposalThreadSummary = getShortSentence(activeProposalSet?.summary)
    ?? getShortSentence(activeProposalSet?.rationale)
    ?? null;
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
  const composerReadyToSend = composerBody.trim().length > 0;
  const composerWorking = submitting || agentTurnPending;
  const hasUnsavedEditChanges = editMode && artifact
    ? isDraftDocument
      ? Boolean(draftDocumentTitle.trim())
      : editBody !== artifact.markdown
    : false;
  const interactionLocked = loading || submitting || agentTurnPending || savingEdit || creatingDocument;
  const agentConnectionState: AgentConnectionState = agentAuth?.state === 'connected'
    ? 'connected'
    : agentAuth?.state === 'connecting'
      ? 'connecting'
      : agentAuth?.state === 'expired' || agentAuth?.state === 'error'
        ? 'error'
        : 'disconnected';
  const discussionAgentLabel = 'Codex';
  const discussionAgentStatus = agentAuthLoading
    ? 'Checking connection'
    : agentAuth?.state === 'connected'
      ? null
      : agentAuth?.state === 'connecting'
        ? 'Connecting'
        : agentAuth?.state === 'expired' || agentAuth?.state === 'error'
          ? 'Connection issue'
          : 'Not connected';
  useEffect(() => {
    if (artifactPath === DRAFT_ARTIFACT_PATH) {
      setLoading(false);
      return;
    }

    void loadArtifact(artifactPath);
  }, [artifactPath]);

  useEffect(() => {
    void loadRecents();
  }, []);

  useEffect(() => {
    void loadAgentAuthStatus();
  }, []);

  useEffect(() => {
    if (agentConnectionState === 'connecting' || agentConnectionState === 'error') {
      setAgentManageOpen(true);
      return;
    }

    if (agentConnectionState !== 'connected') {
      setAgentManageOpen(false);
    }
  }, [agentConnectionState]);

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

  function applyArtifactPayload(
    payload: ArtifactPayload | ProposalMutationResult,
    options?: {
      highlightedRevisionId?: string | null;
      keepHistoryOpen?: boolean;
    }
  ) {
    if (!payload.artifact) {
      return;
    }

    const nextArtifact = payload.artifact;

    setArtifact(nextArtifact);
    setActiveProposalSet(payload.proposalSet ?? null);
    setProposalHistory(payload.proposalHistory ?? []);
    setRevisions(payload.revisions ?? []);
    setLastLoadedUpdatedAt(nextArtifact.updatedAt);
    setHasRemoteUpdate(false);
    setRemoteUpdatedAt(null);
    setDraftPath(nextArtifact.relativePath);
    setPendingLocalComment(null);
    setEditBaseUpdatedAt(nextArtifact.updatedAt);
    setEditNotice(null);
    setHistoryOpen(options?.keepHistoryOpen ?? false);
    setHighlightedRevisionId(options?.highlightedRevisionId ?? null);
    setDraftDocumentTitle('');
    setAttachedSectionId((current) => (current && nextArtifact.sections.some((section) => section.id === current) ? current : null));
    setArtifactPath(nextArtifact.relativePath);

    if (!editMode) {
      setEditBody(nextArtifact.markdown);
    }

    const params = new URLSearchParams(window.location.search);
    params.delete('draft');
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

  useEffect(() => {
    if (!highlightedRevisionId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setHighlightedRevisionId((current) => (current === highlightedRevisionId ? null : current));
    }, 2800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [highlightedRevisionId]);

  async function loadArtifact(nextPath: string, options?: { preserveCurrentOnError?: boolean }) {
    const preserveCurrentOnError = options?.preserveCurrentOnError ?? false;

    if (nextPath === DRAFT_ARTIFACT_PATH) {
      setLoading(false);
      setError(null);
      return;
    }

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
        setRevisions([]);
        setLastLoadedUpdatedAt(null);
        setHasRemoteUpdate(false);
        setRemoteUpdatedAt(null);
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

      const changed = payload.updatedAt !== lastLoadedUpdatedAt;
      setHasRemoteUpdate(changed);
      setRemoteUpdatedAt(changed ? payload.updatedAt : null);
    } catch {
      setHasRemoteUpdate(false);
      setRemoteUpdatedAt(null);
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
    setRemoteUpdatedAt(null);
    setPendingLocalComment(null);
    setDraftDocumentTitle('');
    setAttachedSectionId(null);
    setComposerBody('');
    setHistoryOpen(false);
    setArtifactPath(normalizedPath);
  }

  async function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = composerBody.trim();

    if (!body || interactionLocked || editMode || !resolvedArtifactPath) {
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
    if (interactionLocked || !resolvedArtifactPath) {
      return;
    }

    if (editMode && hasUnsavedEditChanges) {
      setError('Finish or cancel the current manual edit before reloading the document.');
      return;
    }

    await loadArtifact(resolvedArtifactPath, { preserveCurrentOnError: true });
  }

  async function handleRestoreRevision(revisionId: string) {
    if (interactionLocked || editMode || !resolvedArtifactPath || hasPendingProposal || hasRemoteUpdate) {
      return;
    }

    setError(null);

    try {
      const response = await fetch(`/api/revisions/${encodeURIComponent(revisionId)}/restore`, {
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
        throw new Error(payload.error ?? 'Failed to restore that revision.');
      }

      applyArtifactPayload(payload, {
        highlightedRevisionId: payload.appliedRevision?.id ?? null,
        keepHistoryOpen: Boolean(payload.appliedRevision)
      });
      void loadRecents();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Failed to restore that revision.';

      if (message.includes('no longer matches the current document')) {
        setHasRemoteUpdate(true);
      }

      setError(message);
    }
  }

  function handleOpenCreateDocument() {
    if (interactionLocked || editMode) {
      return;
    }

    setArtifact(createDraftArtifact());
    setArtifactPath(DRAFT_ARTIFACT_PATH);
    setDraftDocumentTitle('');
    setEditMode(false);
    setEditBody('');
    setEditBaseUpdatedAt(null);
    setEditNotice(null);
    setActiveProposalSet(null);
    setProposalHistory([]);
    setRevisions([]);
    setHistoryOpen(false);
    setLastLoadedUpdatedAt(null);
    setHasRemoteUpdate(false);
    setRemoteUpdatedAt(null);
    setPendingLocalComment(null);
    setAttachedSectionId(null);
    setComposerBody('');
    setDraftPath(DEFAULT_ARTIFACT_PATH);
    const params = new URLSearchParams(window.location.search);
    params.delete('path');
    params.set('draft', 'new');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    window.requestAnimationFrame(() => {
      draftTitleInputRef.current?.focus();
    });
    setMenuOpen(false);
    setRailOpen(false);
    setError(null);
  }

  function handleCancelDraftDocument() {
    if (creatingDocument || !isDraftDocument) {
      return;
    }

    setArtifact(null);
    setArtifactPath(DEFAULT_ARTIFACT_PATH);
    setDraftDocumentTitle('');
    setEditMode(false);
    setEditBody('');
    setEditBaseUpdatedAt(null);
    setEditNotice(null);
    setRevisions([]);
    setHistoryOpen(false);
    setError(null);
    const params = new URLSearchParams(window.location.search);
    params.delete('draft');
    params.set('path', DEFAULT_ARTIFACT_PATH);
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    void loadArtifact(DEFAULT_ARTIFACT_PATH);
  }

  async function persistDraftDocument(markdown: string, options?: { openRail?: boolean }) {
    const title = draftDocumentTitle.trim();

    if (!title) {
      setError('Add a document title first.');
      draftTitleInputRef.current?.focus();
      return null;
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
          title,
          markdown
        })
      });
      const payload = await readJsonResponse<ArtifactPayload>(response);

      if (!response.ok || !payload.artifact) {
        throw new Error(payload.error ?? 'Failed to create document.');
      }

      applyArtifactPayload(payload);
      setMenuOpen(false);
      setRailOpen(Boolean(options?.openRail));
      void loadRecents();
      return payload;
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create document.');
      return null;
    } finally {
      setCreatingDocument(false);
    }
  }

  function handleEnterEditMode() {
    if (!artifact || interactionLocked) {
      return;
    }

    if (isDraftDocument) {
      const title = draftDocumentTitle.trim();

      if (!title) {
        setError('Add a document title first.');
        draftTitleInputRef.current?.focus();
        return;
      }

      setEditBody(buildDraftSeedMarkdown(title));
      setEditBaseUpdatedAt(null);
      setEditNotice(null);
      setEditMode(true);
      setHistoryOpen(false);
      setRailOpen(false);
      setMenuOpen(false);
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
    setHistoryOpen(false);
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
    if (!artifact || interactionLocked) {
      return;
    }

    if (isDraftDocument) {
      const title = draftDocumentTitle.trim();

      if (!title) {
        setError('Add a document title first.');
        draftTitleInputRef.current?.focus();
        return;
      }

      const initialMarkdown = editBody.trim() ? editBody : buildDraftSeedMarkdown(title);
      const payload = await persistDraftDocument(initialMarkdown);

      if (!payload?.artifact) {
        return;
      }

      setEditMode(false);
      setEditBody(payload.artifact.markdown);
      setEditBaseUpdatedAt(payload.artifact.updatedAt);
      setEditNotice('Saved to document.');
      return;
    }

    if (!editBaseUpdatedAt) {
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

      applyArtifactPayload(payload, {
        highlightedRevisionId: payload.appliedRevision?.id ?? null,
        keepHistoryOpen: Boolean(payload.appliedRevision)
      });
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

  async function handleCreateBlankDraftDocument() {
    if (interactionLocked || editMode) {
      return;
    }

    const title = draftDocumentTitle.trim();

    if (!title) {
      setError('Add a document title first.');
      draftTitleInputRef.current?.focus();
      return;
    }

    await persistDraftDocument(buildDraftSeedMarkdown(title));
  }

  async function handleDiscussDraftDocument() {
    if (interactionLocked || editMode) {
      return;
    }

    const title = draftDocumentTitle.trim();

    if (!title) {
      setError('Add a document title first.');
      draftTitleInputRef.current?.focus();
      return;
    }

    const payload = await persistDraftDocument(buildDraftSeedMarkdown(title), { openRail: true });

    if (payload?.artifact) {
      window.requestAnimationFrame(() => {
        composerRef.current?.focus();
      });
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
      setAgentManageOpen(payload.auth.state === 'connecting');
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
      setAgentManageOpen(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to disconnect ChatGPT/Codex.');
    }
  }

  async function handleProposalMutation(endpoint: string) {
    if (interactionLocked || editMode || !resolvedArtifactPath) {
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

      applyArtifactPayload(payload, {
        highlightedRevisionId: payload.appliedRevision?.id ?? null,
        keepHistoryOpen: Boolean(payload.appliedRevision)
      });
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
      <div className="thread-event-row" key={proposalSet.id} role="listitem">
        <div className="thread-event-log">
          {markerNote}
        </div>
      </div>
    );
  }

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
              <WorkshopWordmark />
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

          <div className="workspace-menu-section workspace-menu-agent" role="region" aria-label="Agent controls">
            <AgentConnectionStatus
              providerName="Codex"
              connectionState={agentConnectionState}
              accountLabel={agentAuth?.accountLabel ?? null}
              message={agentAuthLoading ? 'Checking connection…' : agentAuth?.message ?? (agentConnectionState === 'error' ? 'Reconnect Codex to continue workshop turns.' : null)}
              authUrl={agentAuth?.authUrl}
              deviceCode={agentAuth?.code ?? null}
              actionDisabled={agentAuthLoading || interactionLocked}
              manageOpen={agentManageOpen}
              onManage={() => setAgentManageOpen((current) => !current)}
              onConnect={() => void handleConnectAgent()}
              onDisconnect={() => void handleDisconnectAgent()}
            />
          </div>

          <div className="workspace-menu-section workspace-menu-recents" role="region" aria-label="Recent documents">
            <div className="workspace-menu-section-header" role="group" aria-label="Recent documents header">
              <p className="section-label workspace-menu-label">Recents</p>
            </div>

            {displayedRecentArtifacts.length > 0 ? (
              <div className="recent-list" role="list">
                {displayedRecentArtifacts.map((recent) => {
                  return (
                    <button
                      key={recent.relativePath}
                      className="recent-item"
                      role="listitem"
                      data-active={recent.relativePath === resolvedArtifactPath ? 'true' : 'false'}
                      type="button"
                      disabled={interactionLocked}
                      onClick={() => handleOpenArtifact(recent.relativePath)}
                      aria-label={`Open ${recent.title}, ${recent.relativePath}`}
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
              <p className="empty-thread workspace-menu-empty" role="status" aria-live="polite">
                Create a new document or open another one and it will show up here for quick switching.
              </p>
            )}

            <div className="workspace-menu-cta-dock">
              <button
                className="workspace-menu-cta"
                type="button"
                disabled={interactionLocked}
                onClick={handleOpenCreateDocument}
              >
                <span className="workspace-menu-cta-icon" aria-hidden="true">
                  <FontAwesomeIcon icon={faPenToSquare} />
                </span>
                <span className="workspace-menu-cta-title">Write</span>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-frame" onPointerDown={artifact ? handleReaderSurfacePointerDown : undefined}>
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
                    <p className="reader-title">{isDraftDocument ? (draftDocumentTitle.trim() || DRAFT_ARTIFACT_TITLE) : artifact.title}</p>
                  </div>
                </div>
                <div className="reader-actions" role="group" aria-label="Document actions">
                  {isDraftDocument && !editMode ? (
                    <button
                      className="quiet-inline-action reader-rail-button"
                      type="button"
                      disabled={interactionLocked}
                      onClick={handleCancelDraftDocument}
                    >
                      Cancel
                    </button>
                  ) : null}
                  {editMode ? (
                    <>
                      <button
                        className="quiet-inline-action reader-rail-button"
                        type="button"
                        disabled={savingEdit}
                        onClick={handleCancelEditMode}
                      >
                        Cancel
                      </button>
                      <button
                        className="primary-button compact-button action-primary-button proposal-review-button reader-rail-button"
                        type="button"
                        disabled={interactionLocked || (!isDraftDocument && hasRemoteUpdate)}
                        title={!isDraftDocument && hasRemoteUpdate ? 'Reload the document before saving your edit.' : undefined}
                        onClick={() => void handleSaveEdit()}
                      >
                        {savingEdit ? (isDraftDocument ? 'Creating…' : 'Saving…') : (isDraftDocument ? 'Create' : 'Save')}
                      </button>
                    </>
                  ) : !isDraftDocument ? (
                    <div className="reader-mode-switch" role="group" aria-label="Document mode">
                      <button
                        className={`secondary-button compact-button reader-rail-button reader-mode-button${!railOpen ? ' reader-mode-button-active' : ''}`}
                        type="button"
                        disabled={interactionLocked || hasPendingProposal}
                        title={hasPendingProposal ? 'Accept or reject the pending proposal before editing directly.' : undefined}
                        aria-pressed={!railOpen}
                        onClick={() => {
                          setRailOpen(false);
                          handleEnterEditMode();
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className={`secondary-button compact-button reader-rail-button reader-mode-button${railOpen ? ' reader-mode-button-active' : ''}`}
                        type="button"
                        disabled={interactionLocked}
                        aria-pressed={railOpen}
                        onClick={() => {
                          setMenuOpen(false);
                          setRailOpen(true);
                        }}
                      >
                        Discuss
                      </button>
                    </div>
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
                  remoteUpdateLabel={remoteUpdateLabel}
                  hasStalePendingProposals={hasStalePendingProposals}
                  onCycleProposal={handleCycleProposalInDocument}
                  onReloadDocument={handleReloadDocument}
                />
              ) : null}
            </header>

            {!editMode && !isDraftDocument && historyOpen ? (
              <section className="history-panel" role="region" aria-label="Revision history">
                <div className="history-panel-header">
                  <div>
                    <p className="proposal-kicker">Document history</p>
                    <h2 className="history-panel-title">Revision history</h2>
                    <p className="history-panel-count">
                      {revisions.length} {revisions.length === 1 ? 'saved revision' : 'saved revisions'}
                    </p>
                  </div>
                  <div className="history-panel-copy-block">
                    <p className="history-panel-copy">
                      History stays attached to the document. The newest saved state is always listed first, and restore creates a new current revision instead of erasing the timeline.
                    </p>
                    {historyActionNotice ? (
                      <p className="history-panel-note">{historyActionNotice}</p>
                    ) : null}
                  </div>
                </div>
                {revisions.length > 0 ? (
                  <ol className="history-list">
                    {revisions.map((revision, index) => {
                      const revisionDetail = `${describeRevisionSource(revision.source)} · ${formatArtifactTimestamp(revision.createdAt)}${index === 0 ? ' · Current document state' : ''}`;

                      return (
                        <li
                          key={revision.id}
                          aria-current={index === 0 ? 'step' : undefined}
                          className={`history-item${index === 0 ? ' history-item-highlighted' : ''}${highlightedRevisionId === revision.id ? ' history-item-flash' : ''}`}
                        >
                          <div className="history-item-main">
                            <p className="history-item-summary">{revision.summary}</p>
                            <p className="history-item-detail">{revisionDetail}</p>
                          </div>
                          <div className="history-item-actions">
                            <span className="meta-pill meta-pill-muted history-item-source-badge">
                              {getRevisionSourceBadgeLabel(revision.source)}
                            </span>
                            {index === 0 ? (
                              <span className="meta-pill meta-pill-success history-item-badge">Current</span>
                            ) : (
                              <>
                                <span className="meta-pill meta-pill-muted history-item-distance-badge">{index} back</span>
                                <button
                                  className="secondary-button compact-button history-item-button"
                                  type="button"
                                  disabled={interactionLocked || hasPendingProposal || hasRemoteUpdate}
                                  aria-label={`Restore ${revision.summary}, ${index} back`}
                                  title={
                                    hasPendingProposal
                                      ? 'Resolve the pending proposal before restoring document history.'
                                      : hasRemoteUpdate
                                        ? 'Reload the document before restoring history.'
                                        : `Restore ${index} back as a new current revision.`
                                  }
                                  onClick={() => void handleRestoreRevision(revision.id)}
                                >
                                  Restore
                                </button>
                              </>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <div className="history-empty-state">
                    <p className="history-empty-title">No revisions yet.</p>
                    <p className="context-subtle">
                      Accepted agent changes and manual saves will appear here once the document starts changing.
                    </p>
                  </div>
                )}
              </section>
            ) : null}

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
                    {isDraftDocument ? (
                      <div className="document-empty-state document-draft-state" role="status" aria-live="polite">
                        <p className="proposal-kicker">New document</p>
                        <h2 className="document-empty-title">Name it here, then start writing or bring in the agent.</h2>
                        <p className="context-subtle document-empty-copy">
                          Nothing is saved yet. Press Enter on the title to create a blank document, or keep going and save once the draft becomes real.
                        </p>
                        <input
                          ref={draftTitleInputRef}
                          className="path-input draft-title-input"
                          type="text"
                          value={draftDocumentTitle}
                          disabled={interactionLocked}
                          aria-label="Document title"
                          onChange={(event) => setDraftDocumentTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              void handleCreateBlankDraftDocument();
                            }
                          }}
                          placeholder="Document title"
                          autoFocus
                        />
                        <div
                          className="document-empty-actions document-empty-actions-split"
                          role="group"
                          aria-label="Draft document actions"
                          data-ready={draftDocumentTitle.trim() ? 'true' : 'false'}
                        >
                          <button
                            className="primary-button compact-button action-primary-button"
                            type="button"
                            disabled={interactionLocked || !draftDocumentTitle.trim()}
                            onClick={handleEnterEditMode}
                          >
                            Start writing
                          </button>
                          <button
                            className="secondary-button compact-button"
                            type="button"
                            disabled={interactionLocked || !draftDocumentTitle.trim()}
                            onClick={() => void handleDiscussDraftDocument()}
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
                              remoteUpdateLabel={remoteUpdateLabel}
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
                      <div className="discussion-rail-agent" role="status" aria-live="polite">
                        <p className="discussion-rail-agent-name">
                          <span
                            className={`discussion-rail-agent-dot${agentAuth?.state === 'connected' ? ' discussion-rail-agent-dot-connected' : agentAuth?.state === 'connecting' ? ' discussion-rail-agent-dot-connecting' : ' discussion-rail-agent-dot-disconnected'}`}
                            aria-hidden="true"
                          />
                          <span>{discussionAgentLabel}</span>
                        </p>
                        {discussionAgentStatus ? <p className="discussion-rail-agent-status">{discussionAgentStatus}</p> : null}
                      </div>
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
                      <div className="thread-list" role="list">
                        {displayedConversationComments.map((comment) => {
                          const commentSection = comment.sectionId ? sectionById.get(comment.sectionId) ?? null : null;
                          const isActiveProposalAnchor = activeProposalAnchorCommentId === comment.id;
                          const anchoredProposalTimeline = proposalTimelineByAnchorCommentId.get(comment.id) ?? [];
                          const proposalContextLabel = isActiveProposalAnchor
                            ? null
                            : commentSection?.headingText ?? null;
                          const jumpLabel = activeProposalSpansMultipleSections ? 'Review' : 'View change';

                          return (
                            <div key={comment.id}>
                              <div className="comment-row" data-author={comment.authorType} role="listitem">
                                <div
                                  className={`comment-thread${isActiveProposalAnchor ? ' comment-thread-active-proposal' : ''}`}
                                  data-author={comment.authorType}
                                  data-active-proposal={isActiveProposalAnchor ? 'true' : 'false'}
                                >
                                  {proposalContextLabel ? (
                                    <div className="comment-thread-header" role="group" aria-label="Comment context">
                                      <div className="comment-context-group">
                                        <p className="comment-context comment-context-tight">{proposalContextLabel}</p>
                                      </div>
                                    </div>
                                  ) : null}
                                  {isActiveProposalAnchor ? (
                                    <div className="comment-thread-header comment-thread-header-reviewonly">
                                      {isActiveProposalAnchor ? (
                                        <button
                                          className="quiet-inline-action comment-jump-link"
                                          type="button"
                                          disabled={interactionLocked}
                                          onClick={handleOpenProposalInDocument}
                                        >
                                          {jumpLabel}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <p>{isActiveProposalAnchor ? (activeProposalThreadSummary ?? comment.body) : comment.body}</p>
                                  {isActiveProposalAnchor && activeProposalSet ? (
                                    <ProposalThreadFooter
                                      activeProposalTargetCount={activeProposalTargetSectionIds.length}
                                      interactionLocked={interactionLocked}
                                      hasStalePendingProposals={hasStalePendingProposals}
                                      remoteUpdateLabel={remoteUpdateLabel}
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
                          <div className="comment-row" data-author="agent" role="listitem">
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
                      <p className="empty-thread" role="status" aria-live="polite">
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
                        {remoteUpdateLabel ? (
                          <span className="context-subtle discussion-status-detail">{remoteUpdateLabel}</span>
                        ) : null}
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
                        className={`primary-button composer-submit${composerWorking ? ' composer-submit-working' : ''}`}
                        type="submit"
                        disabled={interactionLocked || !composerReadyToSend}
                        aria-label={composerWorking ? 'Agent working' : 'Send message'}
                      >
                        {composerWorking ? (
                          <span className="composer-submit-icon" aria-hidden="true">
                            <FontAwesomeIcon icon={faCircleNotch} spin />
                          </span>
                        ) : (
                          <span className="composer-submit-icon" aria-hidden="true">
                            <FontAwesomeIcon icon={faArrowUp} />
                          </span>
                        )}
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
