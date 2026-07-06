# Workshop Checkpoints and Branches PRD

## Purpose

Define a familiar, low-complexity product model for saving meaningful document waypoints, bringing a past state forward safely, and preserving trust in the current draft without forcing users to think in version-control terms.

The goal is to keep the core loop easy to understand and practical to build now, while leaving room for more sophistication in later iterations if we need it.

## One-Line Product Goal

Let a user preserve important document states, return to them later, and promote a past state into the current line of work without fear of losing work.

## Why This Matters

Workshop is supposed to support real iteration, not just one forward march.

In real writing and thinking work, people often want to:

- get back to a previous version
- preserve a promising state before a risky change
- try a different direction without losing the current one
- compare "keep it tight" versus "go broader"
- avoid the anxiety that experimentation might destroy a good draft

Without checkpoints and a clear way to promote a past state, Workshop risks feeling fragile exactly when the creative work gets interesting.

## Product Position

Revisions are the low-level safety layer.

Checkpoints are the higher-level human-facing waypoints built on top of that layer.

The product should distinguish:

- automatic history
- intentional saved waypoints
- promotion of a past state
- optional alternate continuations, described in product language rather than branch jargon

This should feel familiar, not complicated.

It is not version control for engineers.

It is confidence and optionality for document work, with room to add complexity later if the product needs it.

## v1 Goal

Prove one clear, familiar loop:

1. user creates a checkpoint before or after an important change
2. user can later jump back to inspect that state
3. if user promotes that earlier state, Workshop makes it current and records a new checkpoint for that promotion
4. the immediately preceding state remains in history because it was already checkpointed
5. Workshop preserves the relationship between the current line of work and the promoted state

If that loop feels understandable and easy to implement, Workshop can support deeper exploration later without making v1 more complicated than it needs to be.

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

### 1. Intentional and Automatic Checkpoints

Workshop must let the user create meaningful waypoints that feel like entries in a revision history, and it must automatically create checkpoints for milestone saves so important document states are preserved without relying only on manual actions.

Requirements:

- a checkpoint can be created explicitly by the user
- Workshop must create automatic checkpoints for milestone saves according to a defined policy
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

### 3. Bringing a Past Checkpoint Forward

Workshop must support bringing an earlier checkpoint forward as the current document version.

Requirements:

- the user can choose an earlier checkpoint and bring it forward into the current line of work
- bringing it forward should create a fresh checkpoint for the new current version
- the source checkpoint and the version it replaced should remain visible in history
- the product should describe this as bringing a version forward or restoring a past checkpoint, not as branch management
- if the product later supports explicit alternate continuations, that language should stay secondary to the bring-forward model

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

### Flow 3: Restore a Checkpoint

1. user selects a checkpoint
2. user chooses `Restore this checkpoint`
3. Workshop makes that checkpoint current
4. Workshop records the restore as a new checkpoint
5. the immediately prior state remains visible in history

Success criteria:

- the user feels like they are restoring a checkpoint, not operating a source-control tool
- earlier work is still visible and trustworthy

## UX Requirements

This flow should feel empowering, not technical.

Required visible elements:

- explicit checkpoint action inside the Checkpoints pane
- history/checkpoint list
- clear current-state indicator
- restore action
- branch/create alternate direction action

Mobile document header requirements:

- the document header stays compact and legible on phone, even if it needs to wrap onto a second line
- the hamburger menu remains the entry point to recent documents and the document list
- the toolbar does not carry document identity
- the filename is moved out of the top toolbar so the reader surface owns the document title
- the toolbar makes room for a checkpoint/history icon button and an Edit / Discuss segmented control
- use Font Awesome `faClockRotateLeft` for the checkpoint/history icon
- tapping the checkpoint/history icon opens a right-side Checkpoints pane
- the Checkpoints pane is a sibling to the Discuss pane
- the Checkpoints pane contains the timeline and the Create checkpoint action
- Create checkpoint lives in the Checkpoints pane, not directly in the main toolbar

Document surface requirements:

- the filename appears as quiet metadata above the document H1 inside the document surface
- the filename should be small, muted, single-line, and truncate with ellipsis if long
- the filename should feel like an annotation to the document, not toolbar chrome

Nice to avoid in v1:

- complex branch graphs
- engineering-centric terminology everywhere
- too many irreversible-feeling choices
- generic document-menu patterns that replace the familiar drawer-based navigation entry point

The experience should feel like:

- saving a promising version and trying another path safely

not:

- operating a source-control dashboard
- a traditional document editor that makes file identity compete with the reading surface

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

- How should the system limit automatic checkpoints so history stays useful and storage does not fill up?
- How much preview is needed before promotion feels safe?
- Should any later alternate-direction UI feel document-like or tab-like?

## Product Test

This PRD is satisfied when all of the following are true:

- a user can create a checkpoint that is identifiable by date and time
- the user can return to a prior checkpoint safely
- restore preserves history
- promoting a prior checkpoint creates a new checkpointed current state
- the state immediately before that promotion remains available in history
- the user can bring an older state forward without needing to think in git terms
- the current line of work remains understandable
- the document header remains compact and legible on mobile without forcing document identity and controls into one cramped row
- the hamburger menu still opens the document / recents drawer
- the filename no longer takes space in the top toolbar
- a checkpoint/history icon fits in the toolbar without requiring an overflow menu
- the filename appears quietly above the document title inside the document surface
- the app still feels like an agent-first document workspace, not a traditional document editor
