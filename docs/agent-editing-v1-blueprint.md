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

## Notes For Future Versions

- Stronger models may return better proposal sets without requiring a product rewrite.
- Later versions can support richer proposal kinds such as multi-region restructuring or explicit "insert new section" flows.
- Later versions can compute and display visual diffs derived from snapshots without changing revision storage fundamentals.
