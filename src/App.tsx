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

export function App() {
  const initialPath = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('path') ?? DEFAULT_ARTIFACT_PATH;
  }, []);

  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const composerDockRef = useRef<HTMLFormElement | null>(null);
  const [artifactPath, setArtifactPath] = useState(initialPath);
  const [draftPath, setDraftPath] = useState(initialPath);
  const [artifact, setArtifact] = useState<Artifact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [composerBody, setComposerBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [attachedSectionId, setAttachedSectionId] = useState<string | null>(null);

  const sectionById = useMemo(() => {
    return new Map((artifact?.sections ?? []).map((section) => [section.id, section]));
  }, [artifact]);

  const attachedSection = attachedSectionId ? sectionById.get(attachedSectionId) ?? null : null;

  useEffect(() => {
    void loadArtifact(artifactPath);
  }, [artifactPath]);

  useEffect(() => {
    if (!navOpen) {
      return;
    }

    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = overflow;
    };
  }, [navOpen]);

  useEffect(() => {
    const dock = composerDockRef.current;

    if (!dock) {
      return;
    }

    const updateDockOffset = () => {
      const dockHeight = dock.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--composer-offset', `${Math.ceil(dockHeight + 28)}px`);
    };

    updateDockOffset();

    const resizeObserver = new ResizeObserver(updateDockOffset);
    resizeObserver.observe(dock);
    window.addEventListener('resize', updateDockOffset);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateDockOffset);
      document.documentElement.style.removeProperty('--composer-offset');
    };
  }, [artifact, attachedSectionId]);

  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    const updateViewportOffset = () => {
      const bottomInset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      document.documentElement.style.setProperty('--viewport-offset', `${Math.ceil(bottomInset)}px`);
    };

    updateViewportOffset();
    viewport.addEventListener('resize', updateViewportOffset);
    viewport.addEventListener('scroll', updateViewportOffset);
    window.addEventListener('orientationchange', updateViewportOffset);

    return () => {
      viewport.removeEventListener('resize', updateViewportOffset);
      viewport.removeEventListener('scroll', updateViewportOffset);
      window.removeEventListener('orientationchange', updateViewportOffset);
      document.documentElement.style.removeProperty('--viewport-offset');
    };
  }, []);

  async function loadArtifact(nextPath: string) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/artifact?path=${encodeURIComponent(nextPath)}`);
      const payload = (await response.json()) as { artifact?: Artifact; error?: string };

      if (!response.ok || !payload.artifact) {
        throw new Error(payload.error ?? 'Failed to load artifact.');
      }

      setArtifact(payload.artifact);
      setDraftPath(nextPath);
      setNavOpen(false);
      setAttachedSectionId((current) => (current && payload.artifact?.sections.some((section) => section.id === current) ? current : null));

      const params = new URLSearchParams(window.location.search);
      params.set('path', nextPath);
      window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    } catch (caughtError) {
      setArtifact(null);
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to load artifact.');
    } finally {
      setLoading(false);
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

    const composerWasFocused = document.activeElement === composerRef.current;
    attachSection(attachedSectionId === sectionId ? null : sectionId);

    if (composerWasFocused) {
      window.requestAnimationFrame(() => {
        composerRef.current?.focus({ preventScroll: true });
      });
    }
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
          path: artifactPath,
          sectionId: attachedSectionId,
          body
        })
      });
      const payload = (await response.json()) as { artifact?: Artifact; error?: string };

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

  return (
    <main className="app-shell">
      {!artifact ? (
        <section className="app-toolbar" aria-label="Artifact controls">
          <div className="toolbar-copy">
            <p className="eyebrow">Workshop</p>
            <p className="toolbar-title">Open artifact</p>
            <p className="toolbar-meta">Review one Markdown artifact with minimal chrome.</p>
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
          <h2>Fetching Markdown and conversation...</h2>
        </section>
      ) : null}

      {artifact ? (
        <>
          <header className="reader-bar">
            <button className="secondary-button compact-button reader-nav-button" type="button" onClick={() => setNavOpen(true)}>
              Sections
            </button>
          </header>

          <div
            className={`nav-overlay${navOpen ? ' nav-overlay-open' : ''}`}
            onClick={() => setNavOpen(false)}
            aria-hidden={navOpen ? 'false' : 'true'}
          />

          <aside className={`nav-drawer${navOpen ? ' nav-drawer-open' : ''}`} aria-label="Section navigation">
            <div className="nav-drawer-header">
              <p className="eyebrow">Sections</p>
              <button className="secondary-button compact-button" type="button" onClick={() => setNavOpen(false)}>
                Close
              </button>
            </div>
            <nav className="nav-drawer-list">
              {artifact.sections.map((section) => (
                <a
                  className="nav-drawer-link"
                  href={`#${section.id}`}
                  key={section.id}
                  onClick={() => setNavOpen(false)}
                >
                  <span>{section.headingText}</span>
                </a>
              ))}
            </nav>
          </aside>

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

                  {section.comments.length > 0 ? (
                    <details className="section-notes">
                      <summary>Notes</summary>
                      <div className="thread-list">
                        {section.comments.map((comment) => (
                          <div className="comment-thread" key={comment.id}>
                            <p className="comment-author">{comment.authorType}</p>
                            <p>{comment.body}</p>
                            <p className="comment-timestamp">
                              {new Date(comment.createdAt).toLocaleString()}
                            </p>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <form className="composer-dock" ref={composerDockRef} onSubmit={(event) => void handleComposerSubmit(event)}>
            {attachedSection ? (
              <div className="composer-context">
                <span className="context-chip">{attachedSection.headingText}</span>
                <button className="text-button" type="button" onClick={() => attachSection(null)}>
                  Clear
                </button>
              </div>
            ) : null}
            <div className="composer-row">
              <textarea
                ref={composerRef}
                className="composer-input"
                rows={1}
                value={composerBody}
                onChange={(event) => setComposerBody(event.target.value)}
                placeholder="Reply about the document..."
              />
              <button className="primary-button composer-submit" type="submit" disabled={submitting}>
                {submitting ? '...' : '➤'}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </main>
  );
}
