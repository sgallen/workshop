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
  - The agent-facing handoff contract is explicit enough that opening a document in Workshop does not depend on Scott-specific path knowledge leaking into the user experience, and recent discussion continuity survives across agent turns.
  - The v1 agent loop is concrete enough to guide implementation instead of more abstract product discussion.
- **Key files:**
  - `server/server.ts`
  - `src/App.tsx`
  - `src/styles.css`
  - `README.md`
  - `docs/v0-technical-plan.md`
  - `docs/project-brief.md`
- **Current focus:**
  - Keep the document-centric handoff explicit in product copy and UI.
  - Preserve explicit freshness/reload cues across header, discussion, and proposal-review surfaces.
  - Keep recent discussion continuity explicit in the agent-turn contract, including one-question-at-a-time review workflows that persist until the human changes mode.
  - Keep revision awareness legible from the document view without forcing a separate history workflow, including on phone-sized layouts.
  - Treat the compact `View history` panel, latest-revision jump path, `Undo last`, and direct history-item restore as the baseline revision-history affordance.
  - Define the minimum useful agent actions for v1.
  - Keep `docs/agent-editing-v1-blueprint.md` aligned with the implementation as the slice sharpens.

### Ready

#### WS-0005 Refactor toward shared core and multiple shells
- **Goal:** Separate Workshop's durable document/proposal/revision logic from the current hosted-local web/runtime shell so both a future device-local native shell and the current host-local flow can reuse the same product core.
- **Notes:** Follow `docs/shared-core-multi-shell-refactor-plan.md`. Keep the refactor incremental, local-first, and in service of the near-term web agent loop rather than as an architecture detour.

#### WS-0002 Implement the first concrete agent actions
- **Goal:** Add the narrow set of section-aware or document-aware agent actions that make the v1 loop genuinely useful.
- **Notes:** Keep the action set small and opinionated. Do not drift into a generic agent shell.

#### WS-0003 Define revision history and reload behavior more crisply
- **Goal:** Make the user-facing model for "what changed" and "what needs reload" obvious once the core session flow is stable.
- **Notes:** Likely follows directly after WS-0001 unless it is fully absorbed there.

#### WS-0004 Capture minimal agent-open contract for Workshop documents
- **Goal:** Document the smallest durable contract for how an agent opens a document in Workshop without exposing local path complexity.
- **Notes:** This is primarily about the hosted-local handoff shape for now, but should avoid assumptions that would prevent a future device-local runtime from using the same product model.

#### WS-0006 Expand the proposal model beyond single-section replacement
- **Goal:** Grow from the current narrow review loop into a document-level draft-evolution model that supports both blank-document creation and richer existing-document refinement.
- **Notes:** Follow `docs/draft-evolution-north-star.md` after the v1 loop is stable. Likely capabilities include whole-document first-draft proposals, insert-new-section proposals, multi-item proposal sets, and structural proposal kinds such as split, merge, reorder, or remove.

### Blocked
- None.

### Done

#### WS-0000 Establish Workshop v0 product direction and initial prototype scaffold
- **Outcome:** Repo scaffolded, product brief and v0 technical plan written, local app/server prototype created, and the first document review workspace plus composer/comment polish pass landed on July 1, 2026.
