# Workshop Checkpoints and Restore PRD

## Purpose

Define the smallest credible product slice that lets a user save meaningful document waypoints, return to one later, and restore it safely without losing trust in the current draft.

This PRD is intentionally narrow.

It is about checkpoint and restore behavior for the current Workshop web app.
It should stay compatible with future shells, but it should not expand into a full branching system yet.

## One-Line Product Goal

Let a user save important document states and restore one later as the new current state without fear of losing work.

## Why This Matters

Workshop is supposed to support real iteration, not just one forward march.

In real writing and thinking work, people often want to:

- preserve a promising draft before a risky change
- get back to an earlier version
- compare a newer direction against a stronger earlier one
- avoid the anxiety that experimentation might destroy something good

Without explicit checkpoints and a trustworthy restore model, Workshop risks feeling fragile exactly when the work becomes interesting.

## Product Position

Revisions are the low-level safety layer.

Checkpoints are the human-facing waypoints built on top of that layer.

Workshop should distinguish:

- routine revision history
- intentional checkpoints
- restoring an older checkpoint as a new current state

This should feel familiar and safe.

It is not git for writers.
It is a calmer document history model that keeps experimentation trustworthy.

## v1 Goal

Prove one clear loop:

1. user creates a checkpoint at a meaningful draft state
2. user later opens the checkpoint list
3. user chooses an earlier checkpoint and restores it
4. Workshop makes that old state current by creating a new current state from it
5. the state that was current just before restore remains in history

If that loop feels understandable and trustworthy, Workshop can grow into richer history behavior later.

## v1 Non-Goals

This PRD does not include:

- explicit branch creation UI
- branch graphs or tree visualizations
- merge tools
- git-style workflows
- multi-user branching
- deep diff tooling across many divergent paths
- a broad shell/header redesign

This is a checkpoints-and-restore slice only.

## Core Product Requirements

### 1. Explicit Checkpoint Creation

Workshop must let the user create an intentional checkpoint.

Requirements:

- the user can explicitly create a checkpoint
- checkpoint creation is lightweight enough that people will actually use it
- each checkpoint is attached to a concrete document state
- each checkpoint records date and time
- the user can optionally provide a short label

### 2. Checkpoint List

Workshop must present checkpoints as a human-readable history list.

Requirements:

- checkpoints are shown in a dedicated history/checkpoints surface
- checkpoint entries stand out from routine revisions
- the current state is clearly indicated
- the user can understand where they are now and what older checkpoint they are selecting

### 3. Safe Restore Model

Workshop must let the user restore an older checkpoint safely.

Requirements:

- restore does not erase history
- restore creates a new current state from the selected older checkpoint
- the state that was current immediately before restore remains available in history
- restore should not create “did I lose later work?” ambiguity

### 4. One Clear v1 Operation

Workshop should use one primary product action for this slice:

- `Restore checkpoint`

Requirements:

- v1 should not split this into separate concepts like restore, promote, and bring forward at the model level
- explanatory copy may describe restore as bringing an older version forward
- the underlying product operation should stay singular and easy to understand

### 5. Compatibility With Existing Authorship Modes

Checkpoint behavior must work across existing Workshop changes.

Requirements:

- manual saves
- accepted proposals
- future restore actions

must all fit the same durable document history model.

## v1 Checkpoint Policy

v1 must use a strict, simple policy so history stays understandable.

### Manual checkpoints

- explicit user-created checkpoints always create checkpoint records

### Restore checkpoints

- restoring a checkpoint creates a new revision
- restoring a checkpoint also creates a new checkpoint record for that restored current state

### Routine revisions

- routine revisions may continue to exist underneath for manual saves and accepted proposals
- not every revision becomes a named checkpoint in v1

### Automatic checkpoints

v1 automatic checkpointing is intentionally minimal.

Requirements:

- Workshop must automatically create a checkpoint on restore
- Workshop does not need broad automatic checkpoint creation for every save in v1
- if broader automatic checkpointing is added later, it should be treated as a separate follow-on decision

This keeps checkpoint history meaningful instead of noisy.

## Product Flows

### Flow 1: Save Checkpoint

1. user reaches a meaningful draft state
2. user chooses `Save checkpoint`
3. user optionally enters a short label
4. Workshop records the checkpoint

Success criteria:

- checkpoint creation feels lightweight and trustworthy

### Flow 2: Restore Earlier Checkpoint

1. user opens the checkpoints list
2. user selects an earlier checkpoint
3. user chooses `Restore checkpoint`
4. Workshop restores that older state as the new current version
5. Workshop records the restore as new history
6. the previously current state remains visible in history

Success criteria:

- the user feels safe restoring
- later work is not perceived as silently deleted
- the new current state clearly comes from the selected older checkpoint

## UX Requirements

This flow should feel empowering, not technical.

Required visible elements:

- explicit `Save checkpoint` action
- checkpoint/history list
- clear current-state indicator
- restore action
- optional checkpoint label input

### Header and document identity requirements

- the top header must leave room for a checkpoint/history action
- the filename should not occupy primary space in the top toolbar
- the filename should appear as quiet metadata above the document title inside the document surface
- document identity should remain clear on phone without competing with primary actions

Avoid in v1:

- branch jargon as the main language
- complex branch graphs
- too many irreversible-feeling choices
- shell redesign that is larger than the checkpoint feature itself

The experience should feel like:

- saving a promising version and returning to it safely

not:

- operating a source-control dashboard

## Technical Requirements

### 1. History-Preserving Restore

Restore operations must create new durable state rather than mutating history in place.

### 2. Checkpoint Metadata

Each checkpoint needs enough metadata to answer:

- what document state does this represent?
- when was it created?
- was it manually created or created by restore?
- what short label, if any, did the user provide?

### 3. Revision Layer Reuse

This feature must build on the existing revision model rather than inventing a disconnected parallel system.

### 4. Future Lineage Compatibility

The underlying model should preserve enough lineage metadata to support richer future history or alternate-direction UI later, without requiring that UI in v1.

## Open Questions

Later, but not required for v1:

- how much preview should exist before restore?
- should checkpoints eventually support richer labels or summaries?
- when, if ever, should Workshop expose alternate directions as a first-class user concept?

## Product Test

This PRD is satisfied when all of the following are true:

- a user can explicitly create a checkpoint
- a checkpoint is identifiable by date and time
- the user can restore a prior checkpoint safely
- restore preserves history
- restoring an older checkpoint creates a new current state rather than overwriting history
- the state immediately before restore remains available in history
- the user can understand where they are now without needing git concepts
- the app still feels like a focused human-agent document workspace rather than a version-control tool
