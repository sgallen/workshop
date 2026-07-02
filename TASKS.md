# TASKS.md

Repo-local implementation backlog for `workshop`.

Use this file for product, design, and engineering work that lives primarily in this repo.
Keep the shared task board for cross-project coordination and repo-level prioritization.

---

## Agent guidance
- Read `AGENTS.md` first.
- Read `docs/project-brief.md` and `docs/v0-technical-plan.md` before changing scope.
- Keep the active slice narrow and artifact-centered.
- Favor phone-usable behavior over desktop-only polish.
- Update this file when work meaningfully starts, shifts, or finishes.

---

## Backlog

### In Progress

#### WS-0001 Stabilize artifact session flow and agent handoff contract
- **Goal:** Turn the current `workshop` prototype into a cleaner v0 artifact-session loop that an agent can open, a human can review on phone, and both can trust after file changes.
- **Why now:** The repo has active uncommitted app/server work but no explicit task tracking, and the next highest-value slice is the session/reload/revision/handoff seam rather than more broad UI exploration.
- **Acceptance:**
  - Opening or resuming an artifact session feels stable and explicit.
  - File changes outside the page can be detected and reloaded cleanly.
  - Revision/history behavior is understandable from the artifact view.
  - The agent-facing handoff contract is explicit enough that opening an artifact in Workshop does not depend on Scott-specific path knowledge leaking into the user experience.
- **Key files:**
  - `server/server.mjs`
  - `src/App.tsx`
  - `src/styles.css`
  - `README.md`
  - `docs/v0-technical-plan.md`
- **Current focus:**
  - Add explicit artifact metadata/reload behavior.
  - Tighten artifact/session UI around revision awareness.
  - Clarify the handoff shape from agent -> Workshop link -> human review.

### Ready

#### WS-0002 Define revision history and reload behavior more crisply
- **Goal:** Make the user-facing model for "what changed" and "what needs reload" obvious once the core session flow is stable.
- **Notes:** Likely follows directly after WS-0001 unless it is fully absorbed there.

#### WS-0003 Capture minimal agent-open contract for Workshop artifacts
- **Goal:** Document the smallest durable contract for how an agent opens an artifact in Workshop without exposing local path complexity.
- **Notes:** This may land as a short doc/README slice once the implementation shape is proven.

### Blocked
- None.

### Done

#### WS-0000 Establish Workshop v0 product direction and initial prototype scaffold
- **Outcome:** Repo scaffolded, product brief and v0 technical plan written, local app/server prototype created, and the first artifact review workspace plus composer/comment polish pass landed on July 1, 2026.
