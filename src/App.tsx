import { FormEvent, MouseEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';

type Comment = {
  id: string;
  authorType: 'human' | 'agent';
  body: string;
  createdAt: string;
  sectionId?: string | null;
};

type Section = {
  id: string;
  headingText: string;
  level: number;
  startLine: number;
  endLine: number;
  renderedHtml: string;
  comments: Comment[];
};

type Artifact = {
  title: string;
  relativePath: string;
  absolutePath: string;
  updatedAt: string;
  sections: Section[];
  comments: Comment[];
};

type RecentArtifact = {
  title: string;
  relativePath: string;
  updatedAt: string | null;
  lastOpenedAt: string | null;
  lastDiscussedAt?: string | null;
  commentCount: number;
};

type AgentAuthState = 'not_connected' | 'connecting' | 'connected' | 'expired' | 'error';

type AgentAuthStatus = {
  state: AgentAuthState;
  provider: 'openai-codex';
  authMode?: string;
  accountLabel?: string;
  authUrl?: string;
  code?: string | null;
  startedAt?: string;
  message?: string;
};

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

async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Unexpected ${response.headers.get('content-type') ?? 'response'} from server.`);
  }
}

function formatRecentDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric'
  }).format(new Date(value));
}

function formatArtifactTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatRecentActivity(recent: RecentArtifact) {
  if (recent.lastDiscussedAt) {
    return `Discussed ${formatRecentDate(recent.lastDiscussedAt)}`;
  }

  if (recent.lastOpenedAt) {
    return `Opened ${formatRecentDate(recent.lastOpenedAt)}`;
  }

  return 'Recent document';
}

function buildDisplayedRecents(
  artifact: Artifact | null,
  recentArtifacts: RecentArtifact[],
  activeCommentCount: number
): RecentArtifact[] {
  if (!artifact) {
    if (recentArtifacts.length >= 3) {
      return recentArtifacts;
    }

    const seen = new Set(recentArtifacts.map((recent) => recent.relativePath));
    const seeded = [...recentArtifacts];

    for (const candidate of DEMO_RECENT_CANDIDATES) {
      if (seen.has(candidate.relativePath)) {
        continue;
      }

      seeded.push(candidate);
      seen.add(candidate.relativePath);

      if (seeded.length >= 3) {
        break;
      }
    }

    return seeded;
  }

  // The active document must remain present in the drawer so it can highlight,
  // but merely opening an existing document must not reorder the stored recents list.
  const seeded = [...recentArtifacts];
  const activeIndex = seeded.findIndex((recent) => recent.relativePath === artifact.relativePath);

  if (activeIndex === -1) {
    seeded.unshift({
      title: artifact.title,
      relativePath: artifact.relativePath,
      updatedAt: artifact.updatedAt,
      lastOpenedAt: artifact.updatedAt,
      lastDiscussedAt: null,
      commentCount: activeCommentCount
    });
  } else {
    seeded[activeIndex] = {
      ...seeded[activeIndex],
      title: artifact.title,
      updatedAt: artifact.updatedAt,
      commentCount: activeCommentCount
    };
  }

  const seen = new Set(seeded.map((recent) => recent.relativePath));

  for (const candidate of DEMO_RECENT_CANDIDATES) {
    if (seen.has(candidate.relativePath) || candidate.relativePath === artifact.relativePath) {
      continue;
    }

    seeded.push(candidate);
    seen.add(candidate.relativePath);

    if (seeded.length >= 3) {
      break;
    }
  }

  return seeded;
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerBody, setComposerBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [attachedSectionId, setAttachedSectionId] = useState<string | null>(null);
  const [manuallyRefreshing, setManuallyRefreshing] = useState(false);
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
  const showOverlay = menuOpen || railOpen;
  const interactiveOverlay = menuOpen;
  const showComposerUtilityRow = Boolean(attachedSection || hasRemoteUpdate);
  const displayedRecentArtifacts = useMemo(() => {
    return buildDisplayedRecents(artifact, recentArtifacts, conversationComments.length);
  }, [artifact, recentArtifacts, conversationComments.length]);

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
    if (!artifact || !railOpen) {
      return;
    }

    void checkForRemoteUpdate();

    const intervalId = window.setInterval(() => {
      void checkForRemoteUpdate();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [artifactPath, artifact, railOpen, lastLoadedUpdatedAt]);

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
  }, [railOpen, conversationComments.length]);

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

  async function loadArtifact(nextPath: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artifact?path=${encodeURIComponent(nextPath)}`);
      const payload = await readJsonResponse<{ artifact?: Artifact; error?: string }>(response);

      if (!response.ok || !payload.artifact) {
        throw new Error(payload.error ?? 'Failed to load document.');
      }

      setArtifact(payload.artifact);
      setLastLoadedUpdatedAt(payload.artifact.updatedAt);
      setHasRemoteUpdate(false);
      setDraftPath(payload.artifact.relativePath);
      setAttachedSectionId((current) => (current && payload.artifact?.sections.some((section) => section.id === current) ? current : null));

      const params = new URLSearchParams(window.location.search);
      params.set('path', payload.artifact.relativePath);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
      void loadRecents();
    } catch (caughtError) {
      setArtifact(null);
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

  async function checkForRemoteUpdate(showButtonFeedback = false) {
    if (!resolvedArtifactPath || !lastLoadedUpdatedAt) {
      return;
    }

    if (showButtonFeedback) {
      setManuallyRefreshing(true);
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
    } finally {
      if (showButtonFeedback) {
        setManuallyRefreshing(false);
      }
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
      void loadArtifact(normalizedPath);
      return;
    }

    setArtifactPath(normalizedPath);
  }

  async function handleComposerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = composerBody.trim();

    if (!body) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
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
      const payload = await readJsonResponse<{ artifact?: Artifact; error?: string }>(response);

      if (!response.ok || !payload.artifact) {
        throw new Error(payload.error ?? 'Failed to save comment.');
      }

      setArtifact(payload.artifact);
      setComposerBody('');
      void loadRecents();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save comment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReloadDocument() {
    await loadArtifact(resolvedArtifactPath);
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

  function renderAgentStatusSummary() {
    if (agentAuthLoading || !agentAuth) {
      return 'Checking agent…';
    }

    switch (agentAuth.state) {
      case 'connected':
        return 'ChatGPT/Codex connected';
      case 'connecting':
        return agentAuth.code ? `Enter code ${agentAuth.code}` : 'Finish connecting ChatGPT/Codex';
      case 'expired':
        return 'ChatGPT/Codex needs reconnect';
      case 'error':
        return 'ChatGPT/Codex connection error';
      default:
        return 'ChatGPT/Codex not connected';
    }
  }

  function renderRailAgentHint() {
    if (agentAuthLoading || !agentAuth) {
      return 'Not connected';
    }

    return agentAuth.state === 'connected' ? 'Connected' : 'Not connected';
  }

  function renderDrawerAgentStatusLabel() {
    if (agentAuthLoading || !agentAuth) {
      return 'Checking';
    }

    switch (agentAuth.state) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'expired':
        return 'Reconnect';
      case 'error':
        return 'Error';
      default:
        return 'Not connected';
    }
  }

  function renderDrawerAgentActionLabel() {
    if (agentAuthLoading) {
      return 'Checking…';
    }

    if (agentAuth?.state === 'connected') {
      return 'Disconnect';
    }

    if (agentAuth?.state === 'expired') {
      return 'Reconnect';
    }

    return 'Connect';
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
                      {renderDrawerAgentStatusLabel()}
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
                      {renderDrawerAgentActionLabel()}
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
                    {renderDrawerAgentStatusLabel()}
                  </span>
                  <span className="agent-row-provider">{agentAuth?.accountLabel ?? 'Codex'}</span>
                </div>
                <button
                  className="secondary-button compact-button discussion-header-button"
                  type="button"
                  onClick={() => void handleDisconnectAgent()}
                >
                  {renderDrawerAgentActionLabel()}
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
                <span className="meta-pill">{renderAgentStatusSummary()}</span>
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
                  value={draftPath}
                  onChange={(event) => setDraftPath(event.target.value)}
                  placeholder={DEFAULT_ARTIFACT_PATH}
                />
                <button className="secondary-button" type="submit">
                  Open
                </button>
              </div>
            </form>
          </section>
        ) : null}

        {error ? <p className="error-banner">{error}</p> : null}

        {loading ? (
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
            </header>

            <div
              className={`reader-layout${railOpen ? ' reader-layout-with-rail' : ''}`}
              onPointerDown={handleReaderSurfacePointerDown}
            >
              <section className="artifact-card artifact-reader">
                <div className="section-list">
                  {artifact.sections.map((section) => (
                    <article
                      className="section-card"
                      data-attached={attachedSectionId === section.id ? 'true' : 'false'}
                      id={section.id}
                      key={section.id}
                      onClick={(event) => handleSectionHeadingClick(section.id, event)}
                    >
                      <div
                        className="section-rendered"
                        dangerouslySetInnerHTML={{ __html: section.renderedHtml }}
                      />
                    </article>
                  ))}
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
                    <span
                      className={`discussion-rail-status${agentAuth?.state === 'connected' ? ' discussion-rail-status-connected' : ' discussion-rail-status-disconnected'}`}
                    >
                      {renderRailAgentHint()}
                    </span>
                    <div className="discussion-header-actions">
                      <button
                        className="secondary-button compact-button discussion-header-button"
                        type="button"
                        onClick={() => void checkForRemoteUpdate(true)}
                        disabled={manuallyRefreshing}
                      >
                        {manuallyRefreshing ? 'Refreshing...' : 'Refresh'}
                      </button>
                      <button
                        className="workspace-menu-close"
                        type="button"
                        onClick={() => setRailOpen(false)}
                        aria-label="Close discussion"
                      >
                        ×
                      </button>
                    </div>
                  </div>

                  <div className="discussion-thread" ref={threadRef}>
                    {conversationComments.length > 0 ? (
                      <div className="thread-list">
                        {conversationComments.map((comment) => {
                          const commentSection = comment.sectionId ? sectionById.get(comment.sectionId) ?? null : null;

                          return (
                            <div className="comment-row" key={comment.id} data-author={comment.authorType}>
                              <div className="comment-thread" data-author={comment.authorType}>
                                {commentSection ? <p className="comment-context">{commentSection.headingText}</p> : null}
                                <p>{comment.body}</p>
                                <p className="comment-timestamp">{formatArtifactTimestamp(comment.createdAt)}</p>
                              </div>
                            </div>
                          );
                        })}
                        <div aria-hidden="true" ref={threadEndRef} />
                      </div>
                    ) : (
                      <p className="empty-thread">
                        {agentAuth?.state === 'connected'
                          ? 'Nothing here yet.'
                          : 'Nothing here yet. Connect the agent in the menu if needed.'}
                      </p>
                    )}
                  </div>

                  <form
                    className="discussion-composer"
                    onSubmit={(event) => void handleComposerSubmit(event)}
                    ref={composerFrameRef}
                  >
                    {showComposerUtilityRow ? (
                      <div className="composer-utility-row">
                        {attachedSection ? (
                          <div className="composer-context composer-context-tight">
                            <span className="context-chip">{attachedSection.headingText}</span>
                            <button className="text-button" type="button" onClick={() => attachSection(null)}>
                              Clear
                            </button>
                          </div>
                        ) : null}
                        {hasRemoteUpdate ? (
                          <div className="discussion-actions discussion-actions-compact">
                            <button className="text-button" type="button" onClick={() => void handleReloadDocument()}>
                              Reload
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {hasRemoteUpdate ? (
                      <div className="discussion-status-inline">
                        <span className="status-pill">Updated</span>
                        <span className="context-subtle">A newer document version is available.</span>
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
                        placeholder={attachedSection ? `Message about ${attachedSection.headingText}...` : 'Reply about the document...'}
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
