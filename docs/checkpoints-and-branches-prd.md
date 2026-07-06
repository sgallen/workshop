# Workshop Checkpoints and Branches PRD

## Purpose

Define a product model for saving meaningful document waypoints, returning to earlier states safely, and exploring alternate directions without losing trust in the current draft.

## One-Line Product Goal

Let a user preserve important document states, return to them later, and branch into alternate directions without fear of losing work.

## Why This Matters

Workshop is supposed to support real iteration, not just one forward march.

In real writing and thinking work, people often want to:

- get back to a previous version
- preserve a promising state before a risky change
- try two different directions
- compare "keep it tight" versus "go broader"
- avoid the anxiety that experimentation might destroy a good draft

Without checkpoints or branching, Workshop risks feeling fragile exactly when the creative work gets interesting.

## Product Position

Revisions are the low-level safety layer.

Checkpoints and branches are the higher-level human-facing shape built on top of that layer.

The product should distinguish:

- automatic history
- intentional saved waypoints
- alternate continuations

This is not version control for engineers.

It is confidence and optionality for document work.

## v1 Goal

Prove one clear loop:

1. user creates a checkpoint before or after an important change
2. user can later jump back to inspect that state
3. if user promotes that earlier state, Workshop records it as a new checkpointed state
4. the immediately preceding state remains in history because it was already checkpointed
5. Workshop preserves the relationship between the current line of work and the alternate or restored line

If that loop feels understandable, Workshop can support deeper exploration without chaos.

## v1 Non-Goals

This PRD does not try to solve:

- full git-like branch management
- arbitrary merge tools
- deep tree visualizations
- simultaneous collaborative branching by many users
- external SCM replacement
- line-by-line diff review across many divergent branches

This is a product-native document branching model, not a developer VCS clone.

## User Story

Scott is working on a document with Workshop.

At some point he likes the current state and wants to preserve it.

Then he wants to try a more ambitious rewrite.

If the rewrite goes badly, he wants to get back.

If both directions are interesting, he wants to keep both alive for a while.

Workshop should support that without making the product feel technical or intimidating.

## Core Product Requirements

### 1. Intentional Checkpoints

Workshop must let the user create meaningful waypoints that feel like entries in a revision history.

Requirements:

- a checkpoint can be created explicitly by the user
- each checkpoint is stamped with the date and time it was created
- the checkpoint is attached to a concrete document state
- checkpoint creation should be fast enough that users actually use it
- the history UI should present checkpoints as a familiar revision history list

### 2. Clear Restore Model

Workshop must support safely returning to a previous checkpoint or revision state.

Requirements:

- restore should preserve history rather than erase it
- if the user promotes a restored state, Workshop should create a new checkpoint for that promotion
- the user should understand that restore and promotion create a new current state from an older one
- the pre-promotion current state should remain visible in history so nothing feels silently lost
- the product should avoid ambiguous "did I lose my later work?" moments

### 3. Alternate Direction Support

Workshop must support branching from an earlier state.

Requirements:

- the user can intentionally start a new branch from a prior checkpoint
- the user can also promote a prior checkpoint into the current line of work
- promotion should create a fresh checkpoint for the new current state, while keeping the source checkpoint and prior current state visible
- the product should make it clear which branch or promoted line is current

### 4. Human-Understandable History

The history model must stay comprehensible.

Requirements:

- named checkpoints should stand out from routine revisions
- branches should be described in product language, not engineering jargon alone
- the user should be able to answer "where am I now?" and "what did this come from?"

### 5. Compatibility With Manual and Agent Changes

Checkpoints and branches must work across all authorship modes.

Requirements:

- manual edits
- accepted proposals
- restores
- future branch creation

all need to fit the same durable history model.

## Product Flows

### Flow 1: Save a Checkpoint

1. user reaches a meaningful draft state
2. user taps `Save checkpoint`
3. user optionally labels it
4. Workshop records the checkpoint

Success criteria:

- checkpoint creation is lightweight and trustworthy

### Flow 2: Restore a Prior State

1. user opens history or checkpoints
2. user selects an earlier checkpoint
3. user previews or confirms restore
4. Workshop restores that state as the current document
5. if the user promotes that state, Workshop records the promotion as a new checkpoint and keeps the immediately prior state in history
6. Workshop preserves later history and makes the prior source state visible

Success criteria:

- the user feels safe restoring
- later work is not perceived as silently deleted
- a promoted checkpoint becomes a new checkpoint without losing the state that was just replaced

### Flow 3: Branch From a Checkpoint

1. user selects a checkpoint
2. user chooses `Try another direction`
3. Workshop creates a new branch from that state
4. the user continues editing or collaborating on the new branch

Success criteria:

- alternate directions feel real, not like overwritten experiments

## UX Requirements

This flow should feel empowering, not technical.

Required visible elements:

- explicit checkpoint action
- history/checkpoint list
- clear current-state indicator
- restore action
- branch/create alternate direction action

Nice to avoid in v1:

- complex branch graphs
- engineering-centric terminology everywhere
- too many irreversible-feeling choices

The experience should feel like:

- saving a promising version and trying another path safely

not:

- operating a source-control dashboard

## Technical Requirements

### 1. History-Preserving Restore

Restore operations must create new durable state rather than mutating history in place.

### 2. Stable Lineage Metadata

Checkpoints and branches need lineage metadata that can answer:

- what state did this come from?
- when was it created?
- what kind of event created it?

### 3. Shared Core Compatibility

The underlying model should be designed to survive the later transition from current web shell to future mobile/native shells.

### 4. Revision Model Reuse

This feature should build on the existing revision layer rather than inventing a disconnected parallel system.

## Open Questions

- Should v1 expose `branch` explicitly, or use gentler language like `Try another direction`?
- Should checkpoints be manual only at first, or also allow a few automatic milestone checkpoints?
- How much preview is needed before restore feels safe?
- Should branch switching feel document-like or tab-like?

## Product Test

This PRD is satisfied when all of the following are true:

- a user can create a checkpoint that is identifiable by date and time
- the user can return to a prior checkpoint safely
- restore preserves history
- promoting a prior checkpoint creates a new checkpointed current state
- the state immediately before that promotion remains available in history
- the user can start an alternate direction from an older state
- the current branch or line of work remains understandable
