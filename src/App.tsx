export function App() {
  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Workshop v0</p>
        <h1>Start in chat. Refine in a focused artifact workspace.</h1>
        <p className="lede">
          The first prototype will optimize for local, mobile-first Markdown
          collaboration over Tailscale.
        </p>
      </section>

      <section className="artifact-card">
        <header className="artifact-header">
          <div>
            <p className="artifact-kicker">Prototype target</p>
            <h2>Markdown artifact review</h2>
          </div>
          <span className="status-pill">Mobile first</span>
        </header>

        <div className="artifact-body">
          <article className="artifact-preview">
            <h3>Example Artifact</h3>
            <p>
              Workshop will open a real Markdown file, render it for comfortable
              reading on phone, and attach comment threads to sections instead
              of scattering revision notes across chat.
            </p>
            <h4>Why it matters</h4>
            <p>
              The artifact becomes the center of gravity once the work turns
              from discussion into refinement.
            </p>
          </article>

          <aside className="comment-panel">
            <h3>Section Thread</h3>
            <div className="comment-thread">
              <p className="comment-author">Human</p>
              <p>
                Tighten this section and make the value proposition more obvious
                on a phone-sized screen.
              </p>
            </div>
            <button className="primary-button" type="button">
              Comment on this section
            </button>
          </aside>
        </div>
      </section>
    </main>
  );
}
