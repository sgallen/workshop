# TASKS.md

Repo-local implementation backlog for `workshop`.

Use this file for product, design, and engineering work that lives primarily in this repo.
Keep the shared task board for cross-project coordination and repo-level prioritization.

---

## Agent guidance
- Read `AGENTS.md` first.
- Read `docs/project-brief.md` and `docs/v0-technical-plan.md` before changing scope.
- Keep the active slice narrow and document-centered.
- Favor phone-usable behavior over desktop-only polish.
- Update this file when work meaningfully starts, shifts, or finishes.

---

## Backlog

### In Progress

#### WS-0001 Define and prove the minimal agent-document loop
- **Goal:** Turn the current `workshop` prototype into a clear v0 loop where an agent opens a document, a human workshops it from phone or laptop, and the document remains the primary object through revision.
- **Why now:** The UI is credible enough that the highest-value next step is no longer generic polish. It is locking the product around the minimal compelling document+agent loop before adding broader features.
- **Acceptance:**
  - Opening or resuming a document session feels stable and explicit.
  - File changes outside the page can be detected and reloaded cleanly.
  - Revision/history behavior is understandable from the document view.
  - The agent-facing handoff contract is explicit enough that opening a document in Workshop does not depend on Scott-specific path knowledge leaking into the user experience.
  - The v1 agent loop is concrete enough to guide implementation instead of more abstract product discussion.
- **Key files:**
  - `server/server.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `README.md`
  - `docs/v0-technical-plan.md`
  - `docs/project-brief.md`
- **Current focus:**
  - Clarify the product around agent-native document workshopping.
  - Add explicit document metadata/reload behavior.
  - Tighten document/session UI around revision awareness.
  - Clarify the handoff shape from agent -> Workshop link -> human review.
  - Define the minimum useful agent actions for v1.
  - Convert the interaction model into an implementation-ready blueprint in `docs/agent-editing-v1-blueprint.md`.

### Ready

#### WS-0005 Refactor toward shared core and multiple shells
- **Goal:** Separate Workshop's durable document/proposal/revision logic from the current web/Node shell so a future native shell can reuse the product core.
- **Notes:** Follow `docs/shared-core-multi-shell-refactor-plan.md`. Keep the refactor incremental and in service of the near-term web agent loop, not as an architecture detour.

#### WS-0002 Implement the first concrete agent actions
- **Goal:** Add the narrow set of section-aware or document-aware agent actions that make the v1 loop genuinely useful.
- **Notes:** Keep the action set small and opinionated. Do not drift into a generic agent shell.

#### WS-0003 Define revision history and reload behavior more crisply
- **Goal:** Make the user-facing model for "what changed" and "what needs reload" obvious once the core session flow is stable.
- **Notes:** Likely follows directly after WS-0001 unless it is fully absorbed there.

#### WS-0004 Capture minimal agent-open contract for Workshop documents
- **Goal:** Document the smallest durable contract for how an agent opens a document in Workshop without exposing local path complexity.
- **Notes:** This may land as a short doc/README slice once the implementation shape is proven.

### Blocked
- None.

### Done

#### WS-0000 Establish Workshop v0 product direction and initial prototype scaffold
- **Outcome:** Repo scaffolded, product brief and v0 technical plan written, local app/server prototype created, and the first document review workspace plus composer/comment polish pass landed on July 1, 2026.
