# Workshop Cross-Session Document Continuity PRD

## Purpose

Define how Workshop should support returning to a document in a later session without depending on the full prior conversation thread remaining present.

## One-Line Product Goal

Let a user reopen a document later, recover the context that matters, and continue work productively even if the original session thread is no longer active.

## Why This Matters

Documents often outlive sessions.

A user may:

- work on a document today
- come back tomorrow
- open it from another device
- continue without the old chat context in front of them

If Workshop binds too much meaning to one live conversation rail, later re-entry will feel disorienting.

The important product question is not "should history disappear?"

It is:

- what context belongs to the document itself
- what context belongs only to a particular session

## Product Position

The document should be the enduring object.

Sessions are temporary working contexts around that object.

Workshop should preserve enough document-native continuity that a user can resume work later without requiring the original live thread to remain the only source of meaning.

This does not mean conversation is unimportant.

It means conversation should not be the only memory substrate.

## v1 Goal

Prove one believable re-entry loop:

1. user works on a document and accumulates comments, proposals, revisions, and decisions
2. the session ends
3. later, the user reopens the document in a fresh session
4. Workshop surfaces the key durable context
5. the user can continue work without feeling lost

If that loop works, Workshop becomes a document product rather than a fragile session wrapper.

## v1 Non-Goals

This PRD does not attempt to solve:

- perfect long-term memory of every conversational nuance
- full multi-user knowledge-management systems
- semantic conversation compression for every turn
- cloud-based shared session sync
- permanent storage of all raw model reasoning

This is about durable document context, not universal memory.

## User Story

Scott works on a document in Workshop, has a useful conversation, reviews proposals, and makes a few decisions.

Later he comes back in a new session where the old live thread is gone or not central.

He should still be able to answer:

- what state is this document in?
- what was the last important move?
- what unresolved work remains?
- what direction was I taking this?

Workshop should help him resume without forcing a full re-read of ephemeral chat.

## Core Product Requirements

### 1. Durable Document-Native Context

Workshop must preserve important context as part of the document's durable state.

Candidate durable context includes:

- comments
- proposal summaries
- accepted/rejected outcomes
- revisions
- checkpoints
- branch lineage

The product should distinguish durable context from transient session-only context.

### 2. Strong Resume Surface

Workshop must offer a useful resume point when reopening a document.

Requirements:

- the user can quickly see the current state of the document
- recent important actions are visible
- unresolved work should be discoverable
- the product should not require the user to reconstruct everything manually from raw history

### 3. Session-Decoupled Continuation

The user must be able to continue work in a fresh session.

Requirements:

- new discussion can begin from the current document state
- the system should not depend on the original session identifier to function meaningfully
- any needed durable context should be available from document state

### 4. Clear Boundaries Between Durable and Ephemeral

Workshop should be explicit about what persists.

Requirements:

- not every conversational detail needs to become durable
- important decisions and outcomes should persist
- transient statuses like "agent is thinking" should not become misleading residue

## Product Flows

### Flow 1: Resume Later

1. user reopens an existing document in a new session
2. Workshop loads the current document state plus durable context
3. Workshop surfaces what matters most for resuming
4. user continues editing or discussion

Success criteria:

- resume feels oriented rather than blank or confusing

### Flow 2: Continue Without Old Conversation Rail

1. user opens a document in a different session environment
2. the exact earlier live thread is not present
3. Workshop still shows durable document history and state
4. user continues work productively

Success criteria:

- the document is not held hostage by one ephemeral thread

## UX Requirements

The resume experience should feel clarifying, not archival.

Required visible elements:

- current document state
- durable recent history
- unresolved or pending state if any
- a clear path to continue editing or discussing

Nice to avoid in v1:

- dumping the full raw session transcript by default
- making the resume view feel like log analysis
- hiding important state inside obscure history panels

The experience should feel like:

- returning to work with enough context to move forward

not:

- reopening a puzzle you have to reconstruct from scratch

## Technical Requirements

### 1. Durable State Ownership

Document continuity must be grounded in document-owned state rather than only external chat/session state.

### 2. Summary-Friendly Model

The data model should allow future compact resume summaries without needing to re-derive everything from raw free-form text.

### 3. Compatibility With Checkpoints and Revisions

Cross-session continuity should build on revisions, checkpoints, and proposal outcomes rather than sidestep them.

## Open Questions

- Should Workshop preserve the full discussion rail per document, or only a distilled subset?
- Should there be a dedicated `Resume where you left off` summary surface?
- What is the smallest durable context that still makes resumption feel intelligent?
- Should unresolved discussion questions become a first-class durable object?

## Product Test

This PRD is satisfied when all of the following are true:

- a user can reopen a document in a fresh session
- the user can understand current state without relying on the old live thread alone
- durable history is sufficient to continue meaningfully
- Workshop cleanly separates document memory from transient session noise
