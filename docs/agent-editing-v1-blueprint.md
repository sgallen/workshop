# Workshop Agent Editing v1 Blueprint

## Purpose

Turn the recent product discussion into a concrete implementation spec that coding agents can execute without re-litigating the interaction model.

This blueprint is intentionally opinionated and narrow.

This doc defines the product model for the next web agent-document loop.
For the architectural extraction path that should make this model reusable across web and future native shells, see `docs/shared-core-multi-shell-refactor-plan.md`.

## Product Summary

Workshop should support document workshopping through three connected layers:

1. `Conversation`
2. `Proposal sets`
3. `Revisions`

The model gets the full document by default.
Focused section state is a hint and UI anchor, not a hard context boundary.

The enduring abstraction is:

- one `agent turn in document context`
- may produce discussion, questions, and/or one proposal set
- accepted proposals become revisions

## Product Rules

These rules should remain stable even as models improve.

1. Do not overly constrain the model's thinking.
2. Constrain the product contract.
3. The full document should normally be available to the model.
4. Section focus signals user attention; it does not hide the rest of the document.
5. Agent-generated changes should be reviewed in the document, not merely described in chat.
6. Only proposals can mutate the canonical document.
7. Every applied mutation must be undoable.
8. Restoring older state creates a new revision; it does not rewrite history.

## Layer Model

### 1. Conversation Layer

Purpose:

- capture user intent
- capture agent reasoning
- allow clarification and iteration

Conversation turns can yield:

- discussion only
- a clarifying question
- a proposal set
- discussion plus a proposal set

The discussion rail is the primary UI for this layer.

### 2. Proposal Layer

Purpose:

- represent provisional document changes before they become canonical

A proposal set is the result of one meaningful agent turn.

A proposal set contains one or more proposal items.

Proposal items should be anchored when possible:

- replace a section
- replace multiple sections
- insert after a section
- insert before a section
- replace the whole document

Proposal items are provisional.
They should appear inline in the document pane and remain visually distinct from canonical document content.

### 3. Revision Layer

Purpose:

- provide safety, undo, and restore points

An accepted proposal item or accepted proposal set creates a new revision snapshot.

Revision history is append-only from the product point of view:

- accept creates a new revision
- restore creates a new revision
- undo creates a new revision or reuses a simple "restore previous snapshot" path internally, but must behave as history-preserving in the product

## UI Model

### Document Pane

The document pane remains the primary reading and review surface.

Responsibilities:

- show canonical rendered document content
- show inline proposal overlays
- show local proposal actions at the proposal anchor
- show revision state when useful

Local proposal controls:

- `Accept`
- `Dismiss`
- `Discuss`

When a proposal is accepted:

- proposal styling disappears
- the document becomes canonical in that state
- a revision is recorded

When a proposal is dismissed:

- the proposal overlay disappears
- the canonical document remains unchanged

### Discussion Rail

The discussion rail owns:

- user prompts
- agent discussion
- clarification turns
- proposal-set summaries
- global proposal controls

Global proposal controls:

- `Accept all`
- `Dismiss all`
- `Jump to first change`
- `Review changes`

The rail should not be the primary place to review long replacement text.
It should summarize and navigate, not become the document.

### History View

Not all of this must land in v1 UI, but the model should support it now.

Responsibilities:

- show revision snapshots
- show timestamp and short summary
- preview a revision
- restore a revision

Recommended revision item metadata:

- timestamp
- summary
- source such as `agent`, `restore`, `manual`, `accept_all`

## Scope Model

The model always gets full document context unless a future practical limit forces a fallback.

Scope still matters, but as product guidance rather than context exclusion.

Supported focus modes:

- `document`
- `section`

If the user focuses a section:

- the UI highlights that section
- the turn payload includes focused section metadata
- the model is told that the user is focused on that section

The model may still propose broader changes if that is the best answer.

### Suggested First Focus Payload

When a section is focused, the first turn payload should include a small explicit metadata block rather than only a raw section ID.

Recommended shape:

```json
{
  "focusedSection": {
    "id": "problem-2",
    "headingText": "Problem",
    "level": 2
  }
}
```

Guidelines:

- include enough metadata for the model to understand what the user is pointing at
- do not attempt full source-range anchoring in the first slice
- treat this focus block as guidance, not as a hard document truncation boundary

This keeps the first turn contract simple while still making section-focused requests explicit.

## Proposal Model

### Proposal Set

The output of one meaningful agent turn.

Fields:

- `id`
- `documentId`
- `conversationTurnId`
- `status`
  - `pending`
  - `partially_applied`
  - `applied`
  - `dismissed`
- `summary`
- `rationale`
- `scope`
  - `section`
  - `document`
  - `mixed`
- `focusedSectionId`
- `createdAt`
- `items`

### Proposal Item

Represents one concrete provisional document change.

Fields:

- `id`
- `proposalSetId`
- `kind`
  - `replace_section`
  - `replace_document`
  - `insert_after_section`
  - `insert_before_section`
- `status`
  - `pending`
  - `applied`
  - `dismissed`
- `sectionId`
- `targetLabel`
- `beforeMarkdown`
- `afterMarkdown`
- `summary`
- `createdAt`

Notes:

- `beforeMarkdown` and `afterMarkdown` are explicit even if they duplicate document state. This makes review and acceptance logic simpler.
- v1 does not need diff persistence. Diff views can be derived later from `beforeMarkdown` and `afterMarkdown`.

## Revision Model

Use full-document snapshots in v1.

### Revision Snapshot

Fields:

- `id`
- `documentId`
- `createdAt`
- `summary`
- `source`
  - `proposal_item_accept`
  - `proposal_set_accept_all`
  - `restore_revision`
  - `manual_save`
- `proposalSetId`
- `markdown`

Notes:

- `markdown` stores the full canonical document content at that point in time.
- This is intentionally simple and favored over diff-only storage for now.

## Conversation Turn Model

### Conversation Turn

Fields:

- `id`
- `documentId`
- `authorType`
  - `human`
  - `agent`
- `body`
- `focusedSectionId`
- `createdAt`

### Agent Turn Result

This is the server response shape for a successful agent turn.

Fields:

- `conversation`
  - one or more agent messages
- `proposalSet`
  - optional

The key rule is that the agent turn may produce discussion only, or discussion plus a proposal set.

## API Surface

Keep the API surface small and explicit.

### 1. Agent Turn

`POST /api/agent/turn`

Request:

```json
{
  "path": "docs/project-brief.md",
  "focusedSectionId": "problem-2",
  "prompt": "Turn this part into a tighter bulleted list."
}
```

Response:

```json
{
  "messages": [
    {
      "id": "turn-agent-1",
      "authorType": "agent",
      "body": "I drafted a tighter bulleted version for this section."
    }
  ],
  "proposalSet": {
    "id": "ps_123",
    "status": "pending",
    "summary": "Tightened the focused section into a bullet list.",
    "scope": "section",
    "focusedSectionId": "problem-2",
    "items": [
      {
        "id": "pi_123",
        "kind": "replace_section",
        "status": "pending",
        "sectionId": "problem-2",
        "targetLabel": "Problem",
        "beforeMarkdown": "Old text...",
        "afterMarkdown": "- New bullet\\n- New bullet"
      }
    ]
  }
}
```

### 2. Accept One Proposal Item

`POST /api/proposals/:proposalSetId/items/:proposalItemId/accept`

Behavior:

- applies the proposal item to the canonical document
- records a new revision snapshot
- marks the proposal item as `applied`
- may mark the proposal set `partially_applied` or `applied`

### 3. Dismiss One Proposal Item

`POST /api/proposals/:proposalSetId/items/:proposalItemId/dismiss`

Behavior:

- removes that proposal item from active review
- leaves canonical document unchanged
- may mark the proposal set `dismissed` if all items are dismissed

### 4. Accept All Proposal Items

`POST /api/proposals/:proposalSetId/accept-all`

Behavior:

- applies the whole proposal set
- records a new revision snapshot
- marks the set `applied`

### 5. Dismiss Entire Proposal Set

`POST /api/proposals/:proposalSetId/dismiss`

Behavior:

- dismisses all still-pending proposal items
- leaves canonical document unchanged

### 6. Undo Last Accepted Revision

`POST /api/revisions/undo-last`

Behavior:

- restores the previous canonical snapshot
- records a new revision entry reflecting the undo/restore action

### 7. List Revisions

`GET /api/revisions?path=docs/project-brief.md`

Response fields should be lightweight:

- `id`
- `createdAt`
- `summary`
- `source`

### 8. Restore Revision

`POST /api/revisions/:revisionId/restore`

Behavior:

- sets the canonical document state to the selected revision content
- records a new latest revision snapshot

## State Machine

### Base States

1. `Idle`
   - no active proposal set

2. `Discussing`
   - user and agent are exchanging conversation turns
   - no active proposal set yet

3. `ProposalPending`
   - one active proposal set exists
   - proposal items are visible in document

4. `ProposalPartiallyApplied`
   - some items accepted, others still pending or dismissed

5. `RevisionCommitted`
   - a proposal accept action created a new canonical revision

6. `RevisionRestored`
   - an older revision was restored as a new latest revision

### Key Transitions

- `Idle -> Discussing`
  - user sends prompt

- `Discussing -> ProposalPending`
  - agent returns a proposal set

- `ProposalPending -> ProposalPartiallyApplied`
  - user accepts one item out of many

- `ProposalPending -> RevisionCommitted`
  - user accepts all

- `ProposalPending -> Discussing`
  - user dismisses the set and continues discussing

- `RevisionCommitted -> Discussing`
  - user continues iterating from the new canonical document state

- `RevisionCommitted -> RevisionRestored`
  - user restores an older revision

## Apply, Dismiss, Undo, Restore Semantics

### Dismiss

- operates on provisional proposal state
- does not mutate canonical document state

### Accept

- mutates canonical document state
- creates a revision snapshot

### Undo

- reverses the most recent accepted canonical change
- should behave as a history-preserving restore

### Restore

- returns to any earlier revision
- always creates a new latest revision
- does not erase intermediate history

## Proposal Anchoring Rules

v1 should prefer the simplest stable anchors.

Priority:

1. section ID derived from headings
2. whole-document replacement

Avoid arbitrary character-range anchoring in v1 unless forced by a concrete use case.

If a proposal targets a focused section:

- anchor to `sectionId`
- render the proposed replacement inline in that section card

If a proposal targets the whole document:

- render all changed sections inline where possible
- allow `Accept all` and `Dismiss all` from the rail

### Suggested First Apply Rule For `replace_section`

For the first implementation cut, `replace_section` should apply only when the targeted section can still be resolved cleanly in the current canonical document.

Recommended first-pass rule:

1. locate the target by `sectionId`
2. derive the current source slice for that section from the latest parsed document structure
3. compare the current section markdown with `beforeMarkdown`
4. if they still match closely enough, replace that slice with `afterMarkdown`
5. if they do not match, return `proposal_conflict`

Practical constraint:

- do not attempt fuzzy multi-region reconciliation in v1
- do not silently apply a proposal against a section that has drifted materially
- prefer an explicit conflict over a surprising partial apply

This keeps the first proposal-apply path predictable and preserves trust in the canonical document.

### Suggested First Apply Rule For `replace_document`

For the first implementation cut, `replace_document` should apply only when the proposal still targets the exact current canonical document snapshot it was generated from.

Recommended first-pass rule:

1. load the latest canonical markdown for the document
2. compare it with the proposal item's `beforeMarkdown`
3. if they still match, replace the full canonical markdown with `afterMarkdown`
4. if they do not match, return `proposal_conflict`

Practical constraint:

- do not attempt three-way merge behavior in v1
- do not silently overwrite newer canonical document edits
- prefer an explicit conflict over a surprising full-document replace

This keeps whole-document proposals consistent with the section-level trust model.

## Minimal v1 Screen States

### Document Viewer

States:

- no active proposal
- active proposal set with one anchored proposal
- active proposal set with many anchored proposals
- revision just accepted

### Discussion Rail

States:

- no active proposal set
- agent responded with discussion only
- active proposal set with global controls
- proposal set dismissed

### History View

Optional for the first implementation cut, but should be structurally supported.

Minimum useful state:

- list revisions
- restore revision

## Minimal v1 Implementation Cut

Build this first:

1. full document always sent to the agent
2. optional focused section metadata sent with the turn
3. one agent turn endpoint returning discussion plus optional proposal set
4. one active proposal set at a time per document
5. proposal items for:
   - `replace_section`
   - `replace_document`
6. inline proposal rendering in the document pane
7. local proposal controls:
   - `Accept`
   - `Dismiss`
   - `Discuss`
8. global proposal controls:
   - `Accept all`
   - `Dismiss all`
   - `Jump to first change`
9. revision snapshot creation on accept
10. `Undo last`

## Explicit Non-Goals For v1

- multiple simultaneous active proposal sets per document
- branching revision UI
- diff-only persistence
- arbitrary inline character-range annotation
- automatic apply as default behavior
- generic multi-provider abstraction
- complex settings surface

## Suggested Build Order

1. Define TypeScript domain types.
2. Add server-side JSON storage for proposal sets and revisions.
3. Add `POST /api/agent/turn`.
4. Add proposal apply and dismiss endpoints.
5. Add revision snapshot creation and `undo-last`.
6. Render inline proposals in the document pane.
7. Add rail summaries and global proposal controls.
8. Add revision list/restore view if capacity remains.

## Current Repo Mapping

This is the shortest path from the blueprint to the code that already exists in this repo.

### Existing Files To Extend

- `src/App.tsx`
  - current document reader
  - discussion rail
  - document open/resume flow
  - current agent auth state and `critique_document` trigger
- `src/styles.css`
  - document pane styling
  - discussion rail styling
  - recents/session-switcher styling
- `server/server.ts`
  - current document load and metadata endpoints
  - current comment persistence
  - current agent auth and critique endpoints
- `server/codex-agent.ts`
  - current ChatGPT/Codex auth/runtime binding
  - current document critique execution path

### Current Endpoints Already In Place

These provide the starting seam for the blueprint:

- `GET /api/artifact`
  - loads the current document payload
- `GET /api/artifact/meta`
  - checks document freshness
- `GET /api/comments`
  - returns current discussion/comments for a document
- `POST /api/comments`
  - appends human or agent-visible discussion state
- `GET /api/agent/auth-status`
  - returns auth/provider availability
- `POST /api/agent/connect`
  - starts the current connect flow
- `POST /api/agent/disconnect`
  - clears the current auth state
- `POST /api/agent/actions/critique-document`
  - current narrow agent turn

### Recommended First Refactor Boundary

Do not replace the current document-loading or auth model first.

Instead:

1. keep document loading as-is
2. keep auth/runtime binding as-is
3. introduce proposal-set and revision domain types beside the existing comment/document payloads
4. evolve the current critique flow into the first `POST /api/agent/turn` path

That keeps the risky rewrite surface small and lets v1 grow from the current prototype instead of restarting it.

### Practical First Implementation Slice

The first coding slice should likely be:

1. add proposal-set and revision storage in `server/server.ts`
2. add TypeScript types for proposal sets, proposal items, revisions, and turn results
3. make the current critique action return discussion plus an optional proposal set shape
4. render one inline proposal kind in `src/App.tsx`
   - start with `replace_section`
5. add one accept path and one dismiss path
6. record a revision snapshot when accept succeeds

If that works, the product has crossed from "agent comments on a document" to "agent proposes concrete document edits that can be accepted into history."

### Suggested First Open/Resume And Reload Contract

The first implementation should make document identity and freshness explicit without inventing a heavy session model.

Recommended contract:

1. the shareable Workshop URL remains document-centric
   - `/?path=<repo-relative-document-path>`
2. the server resolves that path and treats it as the durable document key for v1
3. opening the same path again should resume the same document context
   - same recents identity
   - same proposal-set bucket
   - same revision history bucket
4. the initial document load should return enough metadata for the client to reason about freshness
   - repo-relative path
   - title
   - last modified time or equivalent freshness token
5. the client should keep using the current meta-check pattern to detect file changes outside the page
6. when the underlying file changed externally:
   - if there is no active pending proposal set, allow a straightforward reload into the latest canonical state
   - if there is an active pending proposal set, make the stale state obvious and require an explicit reload or conflict path before accept

Practical v1 rules:

- do not create a second opaque session ID that becomes the primary human-facing object
- do not require the client to remember machine-specific absolute paths once the server has resolved the document
- do not silently keep rendering stale canonical content after freshness checks fail
- do not silently rebase pending proposals onto newly changed file content

This gives `server.ts` and `App.tsx` a crisp first target:

- stable reopen behavior is path-based
- freshness is metadata-driven
- reload is explicit when canonical state changed under the page
- proposal trust is preserved by preferring visible conflict/reload behavior over clever auto-merge

### Suggested First Agent-Open Handoff Contract

The first implementation should make the agent-to-Workshop handoff explicit enough that link creation and human landing behavior are predictable.

Recommended contract:

1. the agent-side caller provides one real document path at the server boundary
2. the server resolves that path into the repo-relative document key used by Workshop
3. the server returns a document-open result that includes:
   - stable document URL
   - repo-relative document path
   - display title
   - whether this was a new open or a resume of existing document context
4. the shareable object the agent sends back to the human is the stable document URL, not a raw local path
5. opening that URL should land the human directly in the document view with:
   - current canonical document content
   - document identity visible
   - current freshness state available
   - current active proposal set and revision cues if they exist

Recommended first response shape:

```json
{
  "artifact": {},
  "documentUrl": "/?path=docs/project-brief.md",
  "resolvedPath": "docs/project-brief.md",
  "title": "Workshop Project Brief",
  "resumed": true
}
```

Practical v1 rules:

- path resolution should happen on the server, not in the human-visible handoff flow
- the returned URL should stay simple enough to share in chat without explanation
- do not require the human to perform a second document-picking step after opening the link
- do not leak machine-specific absolute paths into the shared link or visible primary UI
- if the path cannot be resolved or opened, fail before link-sharing rather than producing a misleading URL

This keeps the handoff aligned with the product promise:

- the agent opens a document
- the human follows one link
- Workshop loads the right document context without setup ceremony

### Suggested v1 Storage Shape

To keep the first server implementation simple, extend the existing local JSON store instead of introducing a second persistence mechanism first.

Recommended top-level additions in `server/server.ts` storage:

```json
{
  "artifacts": {},
  "recents": [],
  "proposalSetsByDocument": {
    "docs/project-brief.md": []
  },
  "revisionsByDocument": {
    "docs/project-brief.md": []
  }
}
```

Guidelines:

- key proposal sets and revisions by repo-relative document path
- keep only one active proposal set per document in v1, even if storage uses arrays
- append revisions rather than mutating history in place
- store full-document revision snapshots for simplicity

Backward-compatibility rules:

- existing stores that only contain `artifacts` and `recents` must still load cleanly
- missing `proposalSetsByDocument` or `revisionsByDocument` keys should default to empty objects
- loading old store files must not require a one-time manual migration step
- the first write after load can persist the expanded shape opportunistically

This keeps the current prototype usable while proposal/revision storage lands incrementally.

### Suggested First TypeScript Additions

The first pass does not need perfect architecture. It needs stable shared types.

Recommended starting types:

- `ProposalSetRecord`
- `ProposalItemRecord`
- `RevisionRecord`
- `AgentTurnResponse`
- `AcceptProposalResult`

Practical location options:

- keep them in `server/server.ts` for the very first slice if that reduces coordination cost
- move them into a shared `types` module only after the proposal/revision loop is real

### First Endpoint Evolution Path

The easiest low-risk progression from today's server is:

1. keep `POST /api/agent/actions/critique-document` working
2. make its internal result shape resemble `AgentTurnResponse`
3. add `POST /api/agent/turn` beside it
4. switch the client once the new path is stable
5. remove or alias the old critique-only endpoint later

This reduces breakage risk while the proposal/revision model is still becoming real.

### Current Client Mapping

The first UI pass should extend the existing `src/App.tsx` surface instead of introducing a second parallel interaction model.

Recommended mapping:

- `reader-bar`
  - keep document identity and high-level document actions here
  - add lightweight proposal-set status only if it helps orientation
- `section-card`
  - primary anchor for inline proposal rendering
  - best first home for `replace_section` proposals
- `discussion-rail`
  - primary home for agent turn summaries, clarifying questions, and proposal-set summaries
  - best first home for global controls such as `Accept all` and `Dismiss all`
- `discussion-composer`
  - current entry point for human prompts
  - natural place to route the first `POST /api/agent/turn`
- `workspace-menu`
  - should stay focused on agent status and document switching
  - should not become the primary proposal-review surface

### Suggested First Freshness And Reload UI

The first implementation should make freshness state visible in a small, predictable place instead of turning reload into a hidden background behavior.

Recommended first-pass behavior:

1. keep document identity in the `reader-bar`
2. add a compact document-state chip or line beside that identity
3. support three useful states:
   - `Up to date`
   - `Changed on disk`
   - `Reload required before apply`
4. when `/api/artifact/meta` shows the file changed externally:
   - show a compact reload banner near the `reader-bar`
   - keep the canonical document visible until the user reloads
5. when there is no active pending proposal set:
   - the banner can offer a primary `Reload` action
6. when there is an active pending proposal set:
   - the banner should explain that pending proposals may be stale
   - proposal accept actions should be blocked until reload or explicit conflict resolution

Minimum useful banner contents:

- short freshness message
- last checked or changed cue if already available from metadata
- `Reload`
- optional `Dismiss` only if dismissal does not hide a real stale state indefinitely

Practical rules:

- do not auto-reload while the user is reading or reviewing proposals
- do not hide stale-state warnings only inside the discussion rail
- do not treat reload as a destructive reset; it is a refresh of canonical file-backed state
- if reload clears an invalid active proposal set, say so explicitly in the UI

This keeps the first freshness model understandable on phone:

- document status is visible near document identity
- reload is a clear user action
- pending proposal trust is preserved when the file changed underneath the page

### Suggested First Revision Awareness UI

The first implementation should make revision state legible from the document view without forcing the user into a separate history workflow.

Recommended first-pass behavior:

1. keep a compact revision status area in the `reader-bar`
2. show the latest revision summary in a lightweight form when available
3. expose one primary document-level history action:
   - `Undo last`
4. expose one secondary navigation action when revisions exist:
   - `View history`
5. after accept or restore:
   - briefly highlight the newest revision cue
   - keep the user in the document pane

Minimum useful revision status contents:

- latest revision summary or short label
- latest revision timestamp or relative recency cue
- source label when it helps orientation
  - `agent`
  - `restore`
  - `undo`

Recommended `Undo last` rules:

- only enable it when there is a clear latest reversible revision
- treat `Undo last` as a document-level action, not a proposal-level action
- after successful undo, refresh the canonical document payload and revision list immediately
- show the undo result as a new latest revision entry rather than silently moving backward in time

Practical constraints:

- do not bury revision status only inside the history view
- do not make the user infer whether a document change is already canonical
- do not overload inline proposal controls with undo behavior meant for accepted revisions
- do not require diff browsing before the user can recover from the most recent accepted change

This keeps revision awareness aligned with the main product loop:

- the document stays primary
- the latest canonical state is understandable at a glance
- reversal of the most recent accepted change is easy without making history the dominant surface

### Suggested First Agent Availability UI

The first implementation should make agent availability obvious at the point where the human tries to ask for help, without turning auth/runtime state into the dominant product surface.

Recommended first-pass behavior:

1. keep the primary agent-availability cue in or near the `discussion-composer`
2. support three useful states:
   - `Ready`
   - `Connecting`
   - `Unavailable`
3. when the agent is `Ready`:
   - the composer stays enabled
   - normal send behavior uses `POST /api/agent/turn`
4. when the agent is `Connecting`:
   - the composer can remain visible but send should be disabled
   - show a short status line instead of a generic spinner-only state
5. when the agent is `Unavailable`:
   - keep the current document and discussion visible
   - disable agent-turn submission
   - surface one clear reconnect or connect action near the composer or workspace controls

Minimum useful availability messaging:

- short status label
- concise reason when known
  - auth missing
  - provider disconnected
  - runtime unavailable
- one obvious next step
  - `Connect`
  - `Reconnect`

Practical rules:

- do not hide agent availability only in a distant settings area
- do not blank or replace the document view when the agent becomes unavailable
- do not conflate `agentTurnPending` with provider/auth loading
- do not allow the composer to fail silently when send is impossible

This keeps the v1 loop trustworthy:

- the human can tell whether the agent can respond
- the document remains usable even when the runtime is down
- reconnect behavior stays close to the place where the user asks for help

### Suggested First History View UI

The first implementation should keep revision history lightweight, phone-usable, and clearly secondary to the document pane.

Recommended first-pass behavior:

1. open history as a simple panel or sheet rather than a separate complex workspace
2. show revisions newest first
3. keep each revision item compact and tappable
4. allow one direct action per item:
   - `Restore`
5. highlight the current newest revision at the top when it resulted from the latest accept, undo, or restore action

Minimum useful revision item contents:

- short summary
- timestamp or relative recency cue
- source label when helpful
- optional proposal-set relationship if already available

Recommended empty and loading states:

- if no revisions exist, show a short empty state that explains history appears after accepted changes
- if revisions are loading, keep the panel skeleton short and avoid blocking the main document pane

Practical rules:

- do not require full diff rendering in v1 history
- do not let history become the default landing surface after an accept
- do not hide `Restore` behind multi-step menus in the first pass
- do not make history panel depth or navigation more complex than the document review flow itself

This keeps the first history UI proportional to the v1 goal:

- revision history is available when needed
- restoring is easy to find
- the document remains the center of gravity

### Suggested First `Review changes` Behavior

The first implementation should keep `Review changes` lightweight and document-first rather than turning it into a separate diff product.

Recommended first-pass behavior:

1. `Review changes` opens or focuses the discussion rail if needed
2. it brings the active proposal summary block into view
3. it immediately triggers the same navigation as `Jump to first change`
4. if the active proposal set is whole-document only, it brings the user to the document top banner instead
5. if there is no active proposal set, the control should be hidden or disabled

Practical rules:

- do not open a separate full-screen diff surface in v1
- do not make `Review changes` depend on a history view
- do not duplicate long replacement text inside the rail just because the user tapped the control
- do not let `Review changes` behave differently from the inline proposal review model

This keeps the control honest in the first slice:

- it helps the user find the active proposal review context
- it preserves the document pane as the primary review surface
- it avoids promising a heavier review workflow than v1 actually supports

### Suggested First Discussion-Only Turn UI

The first implementation should treat discussion-only or clarifying-question turns as first-class outcomes, not as empty proposal failures.

Recommended first-pass behavior:

1. when an agent turn returns messages and no `proposalSet`, append those messages normally in the discussion rail
2. keep the document pane unchanged
3. keep proposal-summary controls hidden when there is no active proposal set
4. if the agent response is primarily a clarifying question:
   - keep focus on the discussion composer
   - make it obvious the next useful move is a human reply, not document review

Minimum useful cues:

- ordinary agent message rendering in the rail
- no empty proposal placeholder
- no stale proposal controls from an earlier cleared turn

Practical rules:

- do not treat lack of a proposal as an error state
- do not show `Accept all`, `Dismiss all`, or `Review changes` when there is no active proposal set
- do not force the user into a history or document jump for question-only turns
- do not blur the distinction between conversational guidance and concrete editable proposals

This keeps the loop coherent:

- some turns help by discussing or asking
- some turns help by proposing edits
- the UI reflects that difference cleanly without making discussion-only turns feel broken

### Suggested First Focused-Section UI Cue

The first implementation should make section focus visible in the document view so section-scoped turns feel anchored to the page, not only to request payloads.

Recommended first-pass behavior:

1. when a section is focused, highlight the matching `section-card` in a lightweight way
2. show a small scope cue near the composer or proposal summary when the current turn is section-scoped
3. if an active proposal set has `focusedSectionId`, reuse that same section label in the rail summary block
4. when focus is cleared, remove the extra section-scoped emphasis without changing the canonical document content

Minimum useful cues:

- subtle visual emphasis on the focused section
- focused section heading text when available
- clear distinction between `section` focus and whole-document scope

Practical rules:

- do not make focus styling look like accepted document change styling
- do not require the user to infer current scope only from hidden IDs or API state
- do not keep stale focused-section cues after the user switches back to document scope
- do not let focused-section emphasis overpower proposal or reload warnings

This keeps section-aware turns understandable in v1:

- the user can see what part of the document is in focus
- discussion, proposals, and scope labels stay aligned
- document scope and section scope feel intentionally different without adding heavy UI

### Suggested First Partially-Applied Proposal UI

The first implementation should make partially applied proposal sets legible instead of collapsing them into either "still pending" or "fully done."

Recommended first-pass behavior:

1. keep the proposal set visible while at least one proposal item is still pending
2. update the rail summary block to reflect mixed item state after each accept or dismiss
3. remove inline overlays only for items that are no longer pending
4. keep remaining pending proposal items reviewable in place
5. when the final pending item is resolved, clear the active proposal set from ordinary review UI

Minimum useful summary cues:

- pending item count
- optional resolved item count
- summary text that still describes the proposal set as a whole
- global actions that still make sense for the remaining pending items

Practical rules:

- do not keep showing `Accept` or `Dismiss` controls on already resolved items
- do not make a partially applied set look identical to a fully pending set if counts are already available
- do not discard the remaining pending context after one item is accepted
- do not treat partial application as a special history mode; it is still ordinary proposal review

This keeps the first multi-item experience coherent:

- accepted items become canonical and disappear from proposal review
- remaining items stay actionable
- the user can tell the set is mid-resolution without leaving the document loop

### Suggested First Dismissed-Proposal UI

The first implementation should make full proposal dismissal feel intentional and clean rather than like proposal state silently vanished.

Recommended first-pass behavior:

1. when all items in a proposal set are dismissed, remove inline proposal overlays from the document pane
2. clear proposal-specific global controls from the discussion rail
3. leave the surrounding conversation visible
4. optionally show one short-lived dismissed-state confirmation in the rail status area
5. return the document to its ordinary no-active-proposal state without forcing a reload

Minimum useful cues:

- canonical document remains unchanged
- active proposal summary block disappears
- brief confirmation that the proposal set was dismissed when that would otherwise feel abrupt

Practical rules:

- do not leave stale `Accept all`, `Dismiss all`, or `Review changes` controls visible after dismissal
- do not create a revision entry for dismissal-only actions
- do not make dismissal feel like document deletion or data loss
- do not keep dismissed proposal text occupying prime rail space once the set is resolved

This keeps dismissal behavior understandable in v1:

- rejection is explicit
- the document view returns to its normal state
- conversation continuity remains intact even though proposal review is over

### Suggested First Idle And Discussing Rail State

The first implementation should make the discussion rail feel useful even when no proposal set is active.

Recommended first-pass behavior:

1. in `Idle`, show a lightweight empty state in the rail rather than a blank column
2. in `Discussing`, render ordinary human and agent conversation without proposal-summary UI
3. keep the composer available as the primary next action when the agent is ready
4. if the document has prior comments or discussion, use that history instead of the empty state

Minimum useful idle-state contents:

- one short line explaining that the user can ask the agent for critique or edits
- no fake proposal placeholders
- no hidden requirement to select a section before starting

Practical rules:

- do not show dormant proposal controls in idle/discussing states
- do not make the rail feel broken just because no proposal has been generated yet
- do not let the empty state overpower existing conversation history
- do not require a document mutation path for every useful turn

This keeps the no-active-proposal path intentional in v1:

- the rail still has a clear purpose
- discussion-first turns feel normal
- proposal review appears only when there is actually something to review

### Suggested First Agent-Turn Pending UI

The first implementation should make "agent is thinking" visible without turning a pending turn into a full-screen loading state.

Recommended first-pass behavior:

1. when a human submits a prompt, set `agentTurnPending`
2. keep the document pane visible and interactive for reading
3. disable duplicate send actions from the composer until the turn resolves
4. show a compact pending cue near the composer or latest rail message
5. clear the pending cue as soon as the turn result arrives or fails

Minimum useful pending cues:

- short status text such as "Agent is thinking"
- visible disabled-send state in the composer
- no fake proposal summary before the server actually returns one

Practical rules:

- do not block the whole page behind a modal spinner
- do not conflate pending-turn state with provider connect/disconnect state
- do not render speculative proposal UI before the response lands
- do not allow repeated accidental submissions while one turn is already in flight

This keeps the first turn loop understandable:

- the user can tell their prompt was accepted
- the document stays primary while waiting
- the eventual response can cleanly become either discussion or a proposal set

### Suggested First `proposal_conflict` UI

The first implementation should make proposal conflicts explicit and recoverable without pretending the app can safely auto-merge.

Recommended first-pass behavior:

1. when accept or restore returns `proposal_conflict`, keep the canonical document unchanged
2. show a compact conflict message in the existing error/status area
3. keep the user oriented on the affected document or section when possible
4. if the conflict came from stale file state, pair the message with the existing reload path
5. preserve the active proposal set unless the server explicitly marks it unusable

Minimum useful conflict messaging:

- short explanation that the proposal no longer matches the current document state
- one obvious next step
  - `Reload`
  - or continue discussing/retry after reload

Practical rules:

- do not silently dismiss a conflicted proposal
- do not partially apply a conflicted proposal and then report failure
- do not describe the conflict as a generic network or provider error
- do not force the user into history view just to recover from a stale proposal

This keeps conflict handling trustworthy in v1:

- failed apply leaves the real document intact
- the user understands why accept did not work
- recovery stays inside the normal document and discussion loop

### Suggested First UI Behavior

For the first implementation cut:

1. user sends a prompt from the existing discussion composer
2. server returns discussion plus optional proposal set
3. discussion messages appear in the existing rail thread
4. `replace_section` proposals render inline at the matching `section-card`
5. each inline proposal gets local `Accept`, `Dismiss`, and `Discuss` actions
6. the rail header or summary area exposes `Accept all` and `Dismiss all` when a proposal set is active

This preserves the current product shape:

- document pane stays primary
- discussion rail stays conversational
- proposal review happens in document context rather than collapsing into a chat-only experience

### Suggested First Mutation Responses

To reduce client/server ambiguity, the first accept/dismiss endpoints should return a compact, re-render-ready payload rather than many narrowly scoped fragments.

Recommended response shape after any proposal mutation:

```json
{
  "artifact": {},
  "proposalSet": {},
  "revisions": [],
  "appliedRevision": null
}
```

Practical rules:

- `artifact`
  - always return the latest canonical document payload after the mutation
- `proposalSet`
  - return the updated active proposal set, or `null` if it is fully dismissed/applied
- `revisions`
  - return a lightweight latest-first revision list for immediate UI refresh
- `appliedRevision`
  - return the new revision record when a mutation creates one
  - otherwise `null`

This lets `App.tsx` update:

- document pane
- inline proposal overlays
- discussion rail proposal summary
- revision affordances

without requiring an immediate burst of follow-up fetches.

### Suggested First Client State Additions

The first `App.tsx` implementation does not need a big client architecture rewrite.

Recommended added state:

- `activeProposalSet`
  - current pending proposal set for the open document
- `revisions`
  - lightweight latest-first revision list for the open document
- `appliedRevisionId`
  - optional short-lived state for highlighting the newest accepted revision
- `agentTurnPending`
  - separate from auth loading so the UI can distinguish "agent is thinking" from "provider/auth state is loading"

Recommended non-goals for the first pass:

- do not introduce a global reducer unless the first slice becomes hard to reason about
- do not build multi-document proposal caching before one-document behavior is stable
- do not block the existing discussion/comment flow on the full proposal model landing at once

Practical first rendering rule:

- if `activeProposalSet` is `null`, the app should behave almost exactly like today's experience
- if `activeProposalSet` exists, the document pane and discussion rail should layer proposal UI on top of the existing document/comment experience rather than replacing it wholesale

### Comment And Conversation Coexistence Rule

The current prototype already has persisted document comments and an existing discussion rail.

The first proposal/revision implementation should not require replacing that model all at once.

Recommended v1 rule:

- treat existing persisted comments as the starting conversation history for a document
- allow new agent turns to append discussion into the same visible rail
- introduce proposal-set state beside the existing comment flow, not instead of it

Practical consequence:

- `comments` remain a valid source for rendering the rail during the first slice
- proposal-set summaries and controls can appear alongside those comments
- a later refactor can rename or normalize `comments` into richer `conversationTurns` once the proposal loop is real

This keeps the first implementation compatible with the current UI and local data while still moving toward the cleaner long-term conversation model.

### Suggested First Proposal Summary Block

When a proposal set is active, the discussion rail should render one compact summary block above the ordinary thread.

Minimum useful contents:

- proposal-set summary text
- proposal count
- scope label
  - `section`
  - `document`
  - `mixed`
- focused section label when relevant
- global actions:
  - `Accept all`
  - `Dismiss all`
  - `Jump to first change`

Practical rule:

- keep the summary block short enough that the discussion rail still feels conversational
- do not repeat long replacement text there
- treat the rail summary as navigation and control, not as the main review surface

This keeps the document pane primary while still making active proposal state obvious.

### Suggested First `Jump to first change` Behavior

The first implementation should keep this control simple and deterministic.

Recommended behavior:

1. find the first still-pending proposal item in the active proposal set
2. if that item has a `sectionId`, scroll the document pane to the matching `section-card`
3. if the first item is `replace_document`, scroll to the top of the document pane
4. optionally highlight the target section briefly after scroll

Practical constraint:

- do not try to compute a visual diff anchor in v1
- do not make this depend on discussion-thread position
- prefer a reliable section/document jump over a clever but fragile anchor

This keeps the global rail control useful without adding fragile navigation logic to the first slice.

### Suggested First `replace_document` UI Behavior

Whole-document proposals should still preserve the document-first review model.

Recommended first-pass behavior:

1. keep the canonical rendered document visible in the main pane
2. show a compact whole-document proposal banner near the top of the document pane
3. use the discussion rail summary block for overview and global actions
4. allow `Jump to first change` to take the user to the top of the document pane

Minimum useful whole-document banner contents:

- short proposal summary
- label that the scope is whole-document
- `Accept all`
- `Dismiss all`
- `Discuss`

Practical constraint:

- do not replace the whole main pane with a separate diff viewer in v1
- do not hide the canonical document behind the proposal
- keep the first whole-document experience consistent with the section-first interaction model

This gives whole-document proposals a credible home without forcing a parallel review surface into the first slice.

### Suggested First `Discuss` Behavior

The first `Discuss` action should reinforce the document-first loop without adding a second complex interaction model.

Recommended behavior:

1. open or focus the discussion rail
2. anchor the next human prompt to the selected proposal item or active proposal set
3. prefill nothing by default, but make the proposal context visible in the rail
4. treat the next submitted message as a follow-up turn against the current document plus that proposal context

Practical constraint:

- `Discuss` should not apply or dismiss anything by itself
- it should deepen the current conversation around a proposal, not fork a separate workflow
- the user should stay oriented in the document while the rail carries the back-and-forth

This keeps the first proposal controls coherent: `Accept` mutates, `Dismiss` rejects, and `Discuss` continues the human-agent loop in context.

### Suggested First Server Helpers

The first server pass should stay explicit rather than prematurely abstract.

Recommended helper responsibilities inside `server/server.ts`:

- `getActiveProposalSet(relativePath)`
  - return the current active proposal set for one document, if any
- `saveProposalSet(relativePath, proposalSet)`
  - append or replace proposal-set state for one document
- `listRevisions(relativePath)`
  - return latest-first revision metadata
- `appendRevision(relativePath, revision)`
  - append a new canonical snapshot revision
- `applyProposalItemToDocument(relativePath, proposalItem)`
  - produce the new canonical markdown and persist it to disk
- `dismissProposalItem(relativePath, proposalSetId, proposalItemId)`
  - mark one proposal item dismissed and update set state

Practical rule:

- keep these helpers near the existing artifact/document persistence code first
- split them into dedicated modules only after the proposal/revision loop is working end to end

### Suggested First Server Flow

For the first accepted proposal path:

1. load the current canonical document
2. load the active proposal set
3. apply one proposal item
4. write the new canonical markdown to disk
5. reparse the document into the existing document payload shape
6. append a revision snapshot
7. update proposal-item and proposal-set status
8. return the compact mutation response payload

That order keeps the document file as the source of truth and reuses the existing document-loading path instead of creating a second canonical representation.

### Suggested First Failure States

The first implementation should keep failure handling simple and explicit.

Recommended first failure buckets:

- `agent_unavailable`
  - auth missing, expired, disconnected, or provider runtime unavailable
- `proposal_conflict`
  - proposal target can no longer be applied cleanly against the current canonical document
- `document_write_failed`
  - file write or snapshot persistence failed
- `invalid_request`
  - missing path, missing proposal IDs, or unsupported mutation request

Practical UI handling:

- show failure text in the existing error banner and/or discussion rail status area
- leave the canonical document unchanged on failed accept/dismiss/apply operations
- preserve the active proposal set when a mutation fails unless the failure proves the proposal is unusable
- force a document reload only when the server can no longer trust the current client state

Practical API handling:

- return a short machine-readable error code
- return a concise user-facing error message
- avoid partial success responses that leave proposal status ambiguous

The v1 goal is not sophisticated recovery. It is predictable failure behavior that does not corrupt the document loop.

### Suggested First Verification Matrix

The first implementation should ship with a small, explicit verification target rather than broad test ambitions.

Minimum useful checks:

1. agent turn without proposal
   - returns discussion messages
   - leaves canonical document unchanged
   - leaves `activeProposalSet` empty

2. agent turn with one `replace_section` proposal
   - returns one active proposal set
   - renders one inline proposal at the targeted section
   - leaves canonical document unchanged before accept

3. accept one proposal item
   - updates canonical markdown on disk
   - reparses the document payload
   - records one new revision
   - clears or updates proposal state correctly

4. dismiss one proposal item
   - leaves canonical markdown unchanged
   - removes or updates proposal state correctly
   - does not create a revision

5. undo last accepted revision
   - restores the previous canonical snapshot
   - records a new latest revision entry
   - leaves history append-only from the product point of view

6. failure on stale/conflicting proposal
   - returns `proposal_conflict`
   - leaves canonical document unchanged
   - does not create a revision

Recommended test split:

- server-focused tests for proposal apply/dismiss/revision behavior
- one lightweight UI flow test for inline proposal rendering and accept/dismiss controls
- manual smoke check on phone-sized layout before calling the slice done

This is enough to keep the first proposal/revision implementation honest without turning the initial slice into a testing detour.

### Suggested First Revision List Contract

The first revision list should stay lightweight and navigation-oriented.

Recommended revision list item shape:

```json
{
  "id": "rev_123",
  "createdAt": "2026-07-03T21:00:00Z",
  "summary": "Accepted rewrite for Problem section",
  "source": "proposal_item_accept",
  "proposalSetId": "ps_123"
}
```

Practical rules:

- do not return full revision markdown in the lightweight list endpoint
- keep list items sufficient for labels, ordering, and restore actions
- fetch or include full snapshot content only when a restore or detailed preview path actually needs it

First-pass UI use:

- render the latest few revisions in newest-first order
- highlight the newest revision after accept or restore
- expose restore from the revision item, not from a separate complex history shell

This keeps revision history understandable without turning v1 into a full diff browser.

### Suggested First Restore Behavior

The first restore interaction should be explicit and conservative.

Recommended behavior:

1. user chooses `Restore` from a revision item
2. server restores that snapshot as the new canonical document state
3. server records a new latest revision with source `restore_revision`
4. client refreshes the canonical document payload, revision list, and any active proposal state
5. the restored revision result becomes the newest highlighted revision in UI

Practical rules:

- restoring a revision should clear any now-invalid active proposal set, or return `proposal_conflict` if the server cannot safely reconcile both states
- restore should never rewrite or delete newer history entries
- the UI should treat restore as a new forward-moving event, not as time travel that erases the timeline

This keeps the first restore path consistent with the append-only revision model already defined above.

### Suggested First Edit Order By File

To reduce churn, land the first implementation slice in this order:

1. `server/server.ts`
   - add storage shape defaults
   - add proposal/revision types if still local
   - add helper functions
   - add new turn and mutation endpoints

2. `server/codex-agent.ts`
   - adapt the current critique path only as needed to support the new turn result shape
   - avoid broad auth/runtime changes in the same slice

3. `src/App.tsx`
   - add proposal/revision state
   - route the composer through the new turn path
   - render one inline proposal kind
   - wire local and global proposal controls

4. `src/styles.css`
   - add only the styling needed for inline proposals, proposal summaries, and revision affordances

5. focused verification
   - run server-side checks first
   - then run the narrow UI and phone smoke pass

Practical sequencing rule:

- do not start with CSS or broad component restructuring
- stabilize the data contract first
- then make the smallest UI changes that prove the loop end to end

## Notes For Future Versions

- Stronger models may return better proposal sets without requiring a product rewrite.
- Later versions can support richer proposal kinds such as multi-region restructuring or explicit "insert new section" flows.
- Later versions can compute and display visual diffs derived from snapshots without changing revision storage fundamentals.
