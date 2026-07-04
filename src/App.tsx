import { FormEvent, KeyboardEvent, MouseEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { buildDisplayedRecents } from '../core/recents/build-displayed-recents';
import type { Artifact, ProposalMutationResult, ProposalSetRecord, RecentArtifact, RevisionRecord } from '../core/types';
import { formatRecentActivity } from './lib/formatting';
import { readJsonResponse } from './lib/read-json-response';
import {
  renderDrawerAgentActionLabel,
  renderDrawerAgentStatusLabel,
  renderRailAgentHint,
  summarizeAgentStatus,
  type AgentAuthStatus
} from './web/agent-auth';

const DEFAULT_ARTIFACT_PATH = 'docs/project-brief.md';
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
  const activeProposalVersion = activeProposalSet?.version ?? 1;
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
    ? activeProposalVersion > 1
      ? 'In review: updated proposal'
      : `In review: ${pendingProposalCount} pending ${pendingProposalCount === 1 ? 'change' : 'changes'}`
    : null;
  const composerPlaceholder = attachedSection
    ? `Message about ${attachedSection.headingText}...`
    : activeProposalSet
      ? 'Reply to refine the pending proposal...'
      : 'Reply about the document...';

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
  }, [railOpen, conversationComments.length, agentTurnPending]);

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
    setAttachedSectionId((current) => (current && nextArtifact.sections.some((section) => section.id === current) ? current : null));

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
    const target = event.target;

    if (!(target instanceof Element) || !target.closest('h1, h2, h3, h4, h5, h6')) {
      return;
    }

    attachSection(attachedSectionId === sectionId ? null : sectionId);
  }

  function handleOpenArtifact(nextPath: string) {
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
    setAttachedSectionId(null);
    setComposerBody('');
    setArtifactPath(normalizedPath);
  }

  async function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = composerBody.trim();

    if (!body) {
      return;
    }

    setSubmitting(true);
    setAgentTurnPending(agentAuth?.state === 'connected');
    setError(null);

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

      setComposerBody('');
      void loadRecents();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save comment.');
    } finally {
      setSubmitting(false);
      setAgentTurnPending(false);
    }
  }

  async function handleReloadDocument() {
    await loadArtifact(resolvedArtifactPath, { preserveCurrentOnError: true });
  }

  async function handleConnectAgent() {
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
    if (!sectionId) {
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
    handleFocusProposalSection(activeProposalSet?.focusedSectionId ?? pendingProposalItems[0]?.sectionId ?? null);
  }

  function handleThreadSummaryKeyDown(event: KeyboardEvent<HTMLElement>, sectionId: string | null) {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }

    event.preventDefault();
    handleFocusProposalSection(sectionId);
  }

  function handleDismissPanels() {
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
        onClick={() => handleFocusProposalSection(targetSectionId)}
        onKeyDown={(event) => handleThreadSummaryKeyDown(event, targetSectionId)}
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
        <div className="workspace-menu-panel" onPointerDown={preventPanelDismiss} onClick={preventPanelDismiss}>
          <div className="workspace-menu-header">
            <div className="workspace-brand-lockup">
              <div className="workspace-logo-mark" aria-hidden="true">W</div>
              <div className="workspace-brand-copy">
                <p className="workspace-brand-name">Workshop</p>
              </div>
            </div>
            <button className="workspace-menu-close" type="button" onClick={() => setMenuOpen(false)} aria-label="Close menu">
              ×
            </button>
          </div>

          <div className="workspace-menu-section workspace-menu-agent">
            <div className="workspace-menu-section-header">
              <p className="section-label workspace-menu-label">Agent</p>
            </div>

            {showAgentConnectCard ? (
              <div className="agent-status-card workspace-menu-agent-card">
                <div className="agent-row agent-row-expanded">
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
                      disabled={agentAuthLoading}
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
              <div className="agent-row agent-row-compact">
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
                >
                  {renderDrawerAgentActionLabel(agentAuth, agentAuthLoading)}
                </button>
              </div>
            )}
          </div>

          <div className="workspace-menu-section workspace-menu-recents">
            <div className="workspace-menu-section-header">
              <p className="section-label workspace-menu-label">Recents</p>
            </div>

            {displayedRecentArtifacts.length > 0 ? (
              <div className="recent-list" role="list">
                {displayedRecentArtifacts.map((recent) => {
                  return (
                    <button
                      key={recent.relativePath}
                      className="recent-item"
                      data-active={recent.relativePath === resolvedArtifactPath ? 'true' : 'false'}
                      type="button"
                      disabled={loading}
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
                Open another document and it will show up here for quick switching.
              </p>
            )}
          </div>
        </div>
      </aside>

      <div className="app-frame">
        {!artifact ? (
          <section className="app-toolbar" aria-label="Document controls">
            <div className="toolbar-header-row">
              <button className="secondary-button compact-button icon-button menu-trigger" type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu">
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
                  disabled={loading}
                  value={draftPath}
                  onChange={(event) => setDraftPath(event.target.value)}
                  placeholder={DEFAULT_ARTIFACT_PATH}
                />
                <button className="secondary-button" type="submit" disabled={loading}>
                  Open
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {error ? <p className="error-banner">{error}</p> : null}

        {loading && !artifact ? (
          <section className="artifact-card">
            <p className="artifact-kicker">Loading document</p>
            <h2>Fetching the latest document and discussion...</h2>
          </section>
        ) : null}

        {artifact ? (
          <>
            <header className="reader-bar" onPointerDown={handleReaderSurfacePointerDown}>
              <div className="reader-bar-row">
                <div className="reader-bar-leading">
                  <button className="secondary-button compact-button icon-button menu-trigger" type="button" onClick={() => {
                    setRailOpen(false);
                    setMenuOpen(true);
                  }} aria-label="Open menu">
                    <span className="menu-trigger-bars" aria-hidden="true">
                      <span />
                      <span />
                    </span>
                  </button>
                  <div className="reader-meta">
                    <p className="reader-title">{artifact.title}</p>
                  </div>
                </div>
                <div className="reader-actions">
                  <button
                    className="secondary-button compact-button reader-rail-button"
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setRailOpen(true);
                    }}
                  >
                    Discuss
                  </button>
                </div>
              </div>
              {activeProposalSet || hasRemoteUpdate || agentTurnPending || loading ? (
                <div className="reader-status-banner">
                  {reviewStateLabel ? (
                    <p className="reader-review-state">
                      <span className="reader-review-dot" aria-hidden="true" />
                      <span>{reviewStateLabel}</span>
                    </p>
                  ) : null}
                  {!reviewStateLabel && loading ? (
                    <p className="reader-review-state" role="status" aria-live="polite">
                      <span className="reader-review-dot reader-review-dot-info" aria-hidden="true" />
                      <span>Refreshing document…</span>
                    </p>
                  ) : null}
                  {!reviewStateLabel && agentTurnPending ? (
                    <p className="reader-review-state">
                      <span className="reader-review-dot reader-review-dot-info" aria-hidden="true" />
                      <span>{pendingTurnMessage}</span>
                    </p>
                  ) : null}
                  {hasRemoteUpdate ? (
                    <div className="reader-meta-pills reader-meta-pills-compact">
                      <span className={`meta-pill${hasStalePendingProposals ? ' meta-pill-warning' : ' meta-pill-info'}`}>
                        {hasStalePendingProposals ? 'Reload required before apply' : 'Changed on disk'}
                      </span>
                    </div>
                  ) : null}
                  {hasRemoteUpdate ? (
                    <button className="text-button" type="button" disabled={loading} onClick={() => void handleReloadDocument()}>
                      {loading ? 'Reloading…' : 'Reload'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </header>

            <div
              className={`reader-layout${railOpen ? ' reader-layout-with-rail' : ''}`}
              onPointerDown={handleReaderSurfacePointerDown}
            >
              <section className="artifact-card artifact-reader">
                <div className="section-list">
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
                          <div className="proposal-inline-block" data-stale={hasStalePendingProposals ? 'true' : 'false'}>
                            <div className="proposal-inline-topbar">
                              <div className="proposal-compare-toggle" aria-label="Compare proposal versions">
                                <button
                                  className={`proposal-toggle-button${proposalCompareMode === 'original' ? ' proposal-toggle-button-active' : ''}`}
                                  type="button"
                                  onClick={() => setProposalCompareModeById((current) => ({ ...current, [proposalItem.id]: 'original' }))}
                                >
                                  Original
                                </button>
                                <button
                                  className={`proposal-toggle-button${proposalCompareMode === 'proposed' ? ' proposal-toggle-button-active' : ''}`}
                                  type="button"
                                  onClick={() => setProposalCompareModeById((current) => ({ ...current, [proposalItem.id]: 'proposed' }))}
                                >
                                  Proposed
                                </button>
                              </div>
                            </div>
                            <div className="proposal-inline-body">
                              <div
                                className="section-rendered proposal-inline-rendered"
                                dangerouslySetInnerHTML={{ __html: proposalRenderedHtml ?? '' }}
                              />
                            </div>
                            <div className="proposal-actions proposal-actions-inline proposal-actions-inline-document">
                              <button
                                className="secondary-button compact-button proposal-review-button"
                                type="button"
                                onClick={() => void handleProposalMutation(`/api/proposals/${activeProposalSet?.id}/items/${proposalItem.id}/dismiss`)}
                              >
                                Reject
                              </button>
                              <button
                                className="primary-button compact-button proposal-review-button"
                                type="button"
                                disabled={hasStalePendingProposals}
                                title={hasStalePendingProposals ? 'Reload the document before accepting this proposal.' : undefined}
                                onClick={() => void handleProposalMutation(`/api/proposals/${activeProposalSet?.id}/items/${proposalItem.id}/accept`)}
                              >
                                Accept
                              </button>
                            </div>
                            {hasStalePendingProposals ? (
                              <div className="proposal-inline-status" role="status" aria-live="polite">
                                <span className="status-pill status-pill-warning">Reload required</span>
                                <span className="context-subtle">Reload the document before accepting this proposal.</span>
                                <button className="text-button" type="button" disabled={loading} onClick={() => void handleReloadDocument()}>
                                  {loading ? 'Reloading…' : 'Reload'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}

                      </article>
                    );
                  })}
                </div>
              </section>

              <aside
                className={`discussion-rail${railOpen ? ' discussion-rail-open' : ''}`}
                aria-label="Discussion"
                onPointerDown={preventPanelDismiss}
                onClick={preventPanelDismiss}
              >
                <div className="discussion-rail-panel">
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

                  <div className="discussion-thread" ref={threadRef}>
                    {conversationComments.length > 0 || agentTurnPending || proposalHistory.length > 0 ? (
                      <div className="thread-list">
                        {conversationComments.map((comment) => {
                          const commentSection = comment.sectionId ? sectionById.get(comment.sectionId) ?? null : null;
                          const isActiveProposalAnchor = activeProposalAnchorCommentId === comment.id;
                          const anchoredProposalTimeline = proposalTimelineByAnchorCommentId.get(comment.id) ?? [];

                          return (
                            <div key={comment.id}>
                              <div className="comment-row" data-author={comment.authorType}>
                                <div
                                  className={`comment-thread${isActiveProposalAnchor ? ' comment-thread-active-proposal' : ''}`}
                                  data-author={comment.authorType}
                                  data-active-proposal={isActiveProposalAnchor ? 'true' : 'false'}
                                >
                                  {commentSection || isActiveProposalAnchor ? (
                                    <div className="comment-thread-header">
                                      {commentSection ? <p className="comment-context comment-context-tight">{commentSection.headingText}</p> : <span />}
                                      {isActiveProposalAnchor ? (
                                        <button className="text-button text-button-muted comment-jump-link" type="button" onClick={handleOpenProposalInDocument}>
                                          Jump to change
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : null}
                                  <p>{comment.body}</p>
                                  {isActiveProposalAnchor && activeProposalSet ? (
                                    <div className="proposal-thread-footer">
                                      <div className="proposal-actions proposal-actions-inline proposal-actions-inline-document proposal-thread-actions">
                                        <button
                                          className="secondary-button compact-button proposal-review-button"
                                          type="button"
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleProposalMutation(`/api/proposals/${activeProposalSet.id}/dismiss`);
                                          }}
                                        >
                                          Reject
                                        </button>
                                        <button
                                          className="primary-button compact-button proposal-review-button"
                                          type="button"
                                          disabled={hasStalePendingProposals}
                                          title={hasStalePendingProposals ? 'Reload the document before accepting these changes.' : undefined}
                                          onClick={(event) => {
                                            event.stopPropagation();
                                            void handleProposalMutation(`/api/proposals/${activeProposalSet.id}/accept-all`);
                                          }}
                                        >
                                          Accept
                                        </button>
                                      </div>
                                      {hasStalePendingProposals ? (
                                        <div className="proposal-inline-status" role="status" aria-live="polite">
                                          <span className="status-pill status-pill-warning">Reload required</span>
                                          <span className="context-subtle">Reload before accepting these changes.</span>
                                          <button
                                            className="text-button"
                                            type="button"
                                            onClick={(event) => {
                                              event.stopPropagation();
                                              void handleReloadDocument();
                                            }}
                                          >
                                            Reload
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>
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
                              <p>{pendingTurnMessage}</p>
                            </div>
                          </div>
                        ) : null}
                        <div aria-hidden="true" ref={threadEndRef} />
                      </div>
                    ) : (
                      <p className="empty-thread">
                        {agentAuth?.state === 'connected'
                          ? 'Ask Codex about this document or a focused section.'
                          : 'Nothing here yet. Connect the agent in the menu if needed.'}
                      </p>
                    )}
                  </div>

                  <form
                    className="discussion-composer"
                    onSubmit={(event) => void handleComposerSubmit(event)}
                    ref={composerFrameRef}
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
                        <button className="text-button" type="button" disabled={loading} onClick={() => void handleReloadDocument()}>
                          {loading ? 'Reloading…' : 'Reload'}
                        </button>
                      </div>
                    ) : null}
                    {agentTurnPending ? (
                      <div className="discussion-status-inline" role="status" aria-live="polite">
                        <span className="status-pill status-pill-info">Agent is thinking</span>
                        <span className="context-subtle">{pendingTurnMessage}</span>
                      </div>
                    ) : null}
                    {error ? <p className="rail-error-inline">{error}</p> : null}
                    <div className="composer-row">
                      <textarea
                        ref={composerRef}
                        className="composer-input"
                        rows={1}
                        value={composerBody}
                        onChange={(event) => setComposerBody(event.target.value)}
                        onFocus={handleComposerFocus}
                        onBlur={handleComposerBlur}
                        disabled={submitting}
                        placeholder={composerPlaceholder}
                      />
                      <button className="primary-button composer-submit" type="submit" disabled={submitting}>
                        {submitting ? '...' : '➤'}
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
