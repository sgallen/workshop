# Workshop Manual Edit Flow PRD

## Purpose

Define the smallest credible product slice that lets a user directly edit document text inside Workshop for quick local changes, then seamlessly return to agent collaboration.

This PRD is intentionally narrow and execution-oriented.

## One-Line Product Goal

Let a user enter a lightweight edit mode in Workshop, type or dictate quick changes directly into the document, save them safely, and then keep workshopping from that new state.

## Why This Matters

Workshop is already strong when the user wants help thinking, restructuring, or revising.

It is weak when the desired change is trivial:

- delete one word
- fix a typo
- jot down a rough sentence
- paste in a half-formed thought
- use mobile keyboard voice input to get raw text down quickly

For those moments, routing through the agent/proposal loop is heavier than the intent.

The product should support both:

- `direct human writing`
- `human-agent refinement`

The direct edit path should make Workshop feel more like a real writing environment, not just a proposal review surface.

## Product Position

Manual edit mode is not a fallback or escape hatch.

It is one of the core interaction modes of Workshop.

Workshop should support three complementary moves:

- write directly
- collaborate with the agent
- return to earlier or alternate states

This PRD covers the first of those in its smallest useful form.

## v1 Goal

Prove one smooth loop:

1. user opens a document in Workshop
2. user enters edit mode
3. user directly changes text with keyboard or mobile voice dictation
4. user saves the edit as canonical document state
5. Workshop records the edit as a human-authored revision
6. user can immediately continue discussing or refining the document with the agent

If that loop feels natural on phone and laptop, manual editing is real enough to grow.

## v1 Non-Goals

This PRD does not try to solve:

- full rich-text or block-based editing
- Google Docs style live collaboration
- arbitrary multi-user concurrent editing
- desktop-grade formatting controls
- track-changes style inline redlining
- merge conflict resolution across simultaneous editors
- a complete replacement for a dedicated Markdown editor

This is a local-first, direct-edit slice inside Workshop.

## User Story

John is working on a document in Workshop.

Sometimes he wants the agent to propose changes.

Sometimes he just wants to:

- delete a word
- add a line
- paste in a rough thought
- speak a scrappy sentence into the phone keyboard

He should be able to enter edit mode, make the change quickly, save it, and then immediately ask the agent to clean it up, build on it, or critique it.

The product should make that feel natural, not like switching to a different tool.

## Core Product Requirements

### 1. Explicit Edit Mode

Workshop must let the user intentionally enter and exit a direct edit mode.

Requirements:

- the user can clearly tell when they are editing versus reviewing
- edit mode is easy to enter from the main document view
- edit mode is easy to leave without confusion
- the mode change should feel lightweight, not like launching a separate subsystem

### 2. Document-First Direct Editing

The user must be able to edit the actual document text inside Workshop.

Requirements:

- text can be inserted, deleted, and replaced directly
- in v1, edit mode covers the whole document source rather than a detached section-only scratch layer
- the flow must work with keyboard input and mobile OS voice dictation
- edits should target the canonical document source, not a detached scratch layer
- the interaction should remain comfortable on both phone and laptop

### 3. Safe Save Model

Direct edits must be explicit and safe.

Requirements:

- the user can save the edit
- the user can cancel out of edit mode without applying partial changes
- Workshop should avoid silent destructive transitions
- if the underlying document changed while editing, Workshop should detect that and avoid blindly overwriting newer state

### 4. Revision Recording

Manual edits must become part of the document history.

Requirements:

- saving a manual edit creates a revision record
- the revision metadata should identify the source as human/manual
- later restore or checkpoint systems must be able to treat manual edits as first-class history

### 5. Clean Return to Agent Collaboration

Manual edits and agent collaboration must coexist naturally.

Requirements:

- after saving, the user can immediately continue the discussion
- the agent should work from the newly saved document state
- Workshop should not imply that the manual edit is a proposal awaiting acceptance
- the discussion rail should remain coherent after manual changes

## Product Flows

### Flow 1: Quick Fix

1. user sees a small wording issue
2. user enters edit mode
3. user deletes or changes a few words
4. user saves
5. Workshop returns to the normal document view

Success criteria:

- the edit takes only a few seconds
- the user never feels forced into a proposal workflow

### Flow 2: Rough Thought Capture

1. user enters edit mode on phone
2. user uses keyboard voice dictation to add rough text
3. user saves the messy thought into the document
4. user asks the agent to clean it up

Success criteria:

- rough input is easy to capture
- the handoff from rough human text to agent refinement feels obvious

### Flow 3: Cancel Editing

1. user enters edit mode
2. user changes text
3. user decides not to keep the change
4. user cancels
5. Workshop restores the prior canonical state

Success criteria:

- cancel is safe and predictable
- Workshop does not accidentally keep partial edits

## UX Requirements

The direct edit flow should feel simple and calm.

Required visible elements:

- clear `Edit` entry point
- obvious edit-mode state
- `Save` and `Cancel`
- a subtle unsaved-changes cue while edits are pending
- understandable feedback after saving

Nice to avoid in v1:

- too many editor toolbars
- formatting chrome that makes Workshop feel like an office suite
- heavy mode-switching ceremony
- duplicated save controls in too many places

The experience should feel like:

- quick local authorship inside the same document product

not:

- being thrown into a totally separate editor app

## Technical Requirements

### 1. Canonical Source Editing

The system should edit the canonical underlying document source, not a secondary rendered-only representation.

### 2. Revision Integration

Manual saves must create revision records that fit the same durable document history model as accepted proposals and restores.

### 3. Stale State Protection

If the document changed since edit mode began, Workshop must avoid unsafe overwrite behavior and require a refresh or explicit recovery path.

### 4. Mobile-Friendly Input Surface

The edit surface should be compatible with standard mobile keyboard behavior, including native dictation.

## Open Questions

- Should Workshop auto-scroll the user back to the edited location after save?
- Should entering edit mode temporarily suppress proposal overlays and discussion emphasis?

## Product Test

This PRD is satisfied when all of the following are true:

- a user can enter edit mode from the document view
- the user can make a tiny text change directly
- the user can save or cancel safely
- a saved edit updates the canonical document
- the saved edit creates a human/manual revision
- the user can immediately continue workshopping from that updated state
