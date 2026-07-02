import { FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from 'react';

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

const DEFAULT_ARTIFACT_PATH = 'docs/project-brief.md';

async function readJsonResponse<T>(response: Response): Promise<T> {
  const raw = await response.text();

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`Unexpected ${response.headers.get('content-type') ?? 'response'} from server.`);
  }
}

function formatShortTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function App() {
  const initialPath = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('path') ?? DEFAULT_ARTIFACT_PATH;
  }, []);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const [artifactPath, setArtifactPath] = useState(initialPath);
  const [draftPath, setDraftPath] = useState(initialPath);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerBody, setComposerBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [attachedSectionId, setAttachedSectionId] = useState<string | null>(null);
  const [checkingUpdates, setCheckingUpdates] = useState(false);
  const [hasRemoteUpdate, setHasRemoteUpdate] = useState(false);
  const [lastLoadedUpdatedAt, setLastLoadedUpdatedAt] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState(window.location.origin);
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const sectionById = useMemo(() => {
    return new Map((artifact?.sections ?? []).map((section) => [section.id, section]));
  }, [artifact]);

  const attachedSection = attachedSectionId ? sectionById.get(attachedSectionId) ?? null : null;
  const conversationComments = artifact?.comments ?? [];
  const resolvedArtifactPath = artifact?.relativePath ?? artifactPath;

  useEffect(() => {
    void loadArtifact(artifactPath);
  }, [artifactPath]);

  useEffect(() => {
    void loadConfig();
  }, []);

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

  async function loadArtifact(nextPath: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artifact?path=${encodeURIComponent(nextPath)}`);
      const payload = await readJsonResponse<{ artifact?: Artifact; error?: string }>(response);

      if (!response.ok || !payload.artifact) {
        throw new Error(payload.error ?? 'Failed to load artifact.');
      }

      setArtifact(payload.artifact);
      setLastLoadedUpdatedAt(payload.artifact.updatedAt);
      setHasRemoteUpdate(false);
      setDraftPath(payload.artifact.relativePath);
      setAttachedSectionId((current) => (current && payload.artifact?.sections.some((section) => section.id === current) ? current : null));

      const params = new URLSearchParams(window.location.search);
      params.set('path', payload.artifact.relativePath);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    } catch (caughtError) {
      setArtifact(null);
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to load artifact.');
    } finally {
      setLoading(false);
    }
  }

  async function loadConfig() {
    try {
      const response = await fetch('/api/config');
      const payload = await readJsonResponse<{ appOrigin?: string }>(response);

      if (response.ok && payload.appOrigin) {
        setAppOrigin(payload.appOrigin);
      }
    } catch {
      // Keep the current browser origin as a harmless fallback.
    }
  }

  async function checkForRemoteUpdate() {
    if (!resolvedArtifactPath || !lastLoadedUpdatedAt) {
      return;
    }

    setCheckingUpdates(true);

    try {
      const response = await fetch(`/api/artifact/meta?path=${encodeURIComponent(resolvedArtifactPath)}`);
      const payload = await readJsonResponse<{ updatedAt?: string; error?: string }>(response);

      if (!response.ok || !payload.updatedAt) {
        throw new Error(payload.error ?? 'Failed to inspect artifact.');
      }

      setHasRemoteUpdate(payload.updatedAt !== lastLoadedUpdatedAt);
    } catch {
      setHasRemoteUpdate(false);
    } finally {
      setCheckingUpdates(false);
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
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save comment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReloadDocument() {
    await loadArtifact(resolvedArtifactPath);
  }

  async function handleCopyShareLink() {
    const shareUrl = `${appOrigin}/?path=${encodeURIComponent(resolvedArtifactPath)}`;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareState('copied');
    } catch {
      setShareState('failed');
    }

    window.setTimeout(() => {
      setShareState('idle');
    }, 2500);
  }

  return (
    <main className="app-shell">
      {!artifact ? (
        <section className="app-toolbar" aria-label="Artifact controls">
          <div className="toolbar-copy">
            <p className="eyebrow">Workshop</p>
            <p className="toolbar-title">Open artifact</p>
            <p className="toolbar-meta">A quieter, phone-first review surface for one document and one running discussion.</p>
          </div>
          <form
            className="path-form"
            onSubmit={(event) => {
              event.preventDefault();
              setArtifactPath(draftPath.trim() || DEFAULT_ARTIFACT_PATH);
            }}
          >
            <div className="path-row">
              <input
                id="artifact-path"
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
          <p className="artifact-kicker">Loading artifact</p>
          <h2>Fetching Markdown and discussion...</h2>
        </section>
      ) : null}

      {artifact ? (
        <>
          <header className="reader-bar">
            <div className="reader-bar-row">
              <div className="reader-meta">
                <p className="eyebrow">Workshop Session</p>
                <p className="reader-title">{artifact.title}</p>
              </div>
              <div className="reader-actions">
                {hasRemoteUpdate ? (
                  <button className="secondary-button compact-button" type="button" onClick={() => void handleReloadDocument()}>
                    Reload document
                  </button>
                ) : null}
                <button className="secondary-button compact-button" type="button" onClick={() => void handleCopyShareLink()}>
                  Copy share link
                </button>
                <button
                  className="secondary-button compact-button reader-rail-button"
                  type="button"
                  onClick={() => setRailOpen((current) => !current)}
                >
                  {railOpen ? 'Close discussion' : 'Open discussion'}
                </button>
              </div>
            </div>
            <div className="reader-link-row">
              <p className="reader-link-path">{artifact.relativePath}</p>
              <div className="reader-meta-pills" aria-label="Artifact metadata">
                <span className="meta-pill">Markdown</span>
                <span className="meta-pill">{conversationComments.length} {conversationComments.length === 1 ? 'message' : 'messages'}</span>
                <span className="meta-pill meta-pill-muted">Synced {formatShortTimestamp(artifact.updatedAt)}</span>
                {shareState === 'copied' ? <span className="meta-pill meta-pill-muted">Link copied</span> : null}
                {shareState === 'failed' ? <span className="meta-pill meta-pill-muted">Copy failed</span> : null}
              </div>
            </div>
            {hasRemoteUpdate ? (
              <div className="reader-status-banner">
                <span className="status-pill">Document updated</span>
                <span className="context-subtle">Reload when you want the latest file state.</span>
              </div>
            ) : null}
          </header>

          <div className={`rail-overlay${railOpen ? ' rail-overlay-open' : ''}`} onClick={() => setRailOpen(false)} aria-hidden={railOpen ? 'false' : 'true'} />

          <div className={`reader-layout${railOpen ? ' reader-layout-with-rail' : ''}`}>
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

            <aside className={`discussion-rail${railOpen ? ' discussion-rail-open' : ''}`} aria-label="Discussion">
              <div className="discussion-rail-panel">
                <div className="discussion-rail-header">
                  <div className="discussion-copy">
                    <p className="discussion-title">Discussion</p>
                    <p className="discussion-subtitle">
                      {conversationComments.length > 0
                        ? `${conversationComments.length} ${conversationComments.length === 1 ? 'message' : 'messages'} on this artifact`
                        : 'Start the thread for this artifact'}
                    </p>
                  </div>
                  <div className="discussion-header-actions">
                    <button
                      className="secondary-button discussion-header-button"
                      type="button"
                      onClick={() => void checkForRemoteUpdate()}
                      disabled={checkingUpdates}
                    >
                      {checkingUpdates ? 'Refreshing...' : 'Refresh'}
                    </button>
                    <button className="secondary-button discussion-header-button" type="button" onClick={() => setRailOpen(false)}>
                      Close
                    </button>
                  </div>
                </div>

                <div className="discussion-thread">
                  {conversationComments.length > 0 ? (
                    <div className="thread-list">
                      {conversationComments.map((comment) => {
                        const commentSection = comment.sectionId ? sectionById.get(comment.sectionId) ?? null : null;

                        return (
                          <div className="comment-row" key={comment.id} data-author={comment.authorType}>
                            <div className="comment-thread" data-author={comment.authorType}>
                              {commentSection ? <p className="comment-context">{commentSection.headingText}</p> : null}
                              <p>{comment.body}</p>
                              <p className="comment-timestamp">
                                {new Date(comment.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="empty-thread">
                      Nothing here yet. Select a section or write about the document to get started.
                    </p>
                  )}
                </div>

                <form className="discussion-composer" onSubmit={(event) => void handleComposerSubmit(event)}>
                  <div className="composer-utility-row">
                    {attachedSection ? (
                      <div className="composer-context composer-context-tight">
                        <span className="context-chip">{attachedSection.headingText}</span>
                        <button className="text-button" type="button" onClick={() => attachSection(null)}>
                          Clear
                        </button>
                      </div>
                    ) : <span />}
                    {hasRemoteUpdate ? (
                      <div className="discussion-actions discussion-actions-compact">
                        <button className="text-button" type="button" onClick={() => void handleReloadDocument()}>
                          Reload
                        </button>
                      </div>
                    ) : <span />}
                  </div>
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
    </main>
  );
}
