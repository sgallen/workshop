# Workshop New Document Creation PRD

## Purpose

Define the smallest credible product slice that lets a user create a new blank or lightly scaffolded document from inside Workshop itself.

Agent-passed links into existing documents remain a compatible way to enter Workshop, but they are not the focus of this PRD.

This PRD is for the current web app and should also point toward the future native mobile app.

## One-Line Product Goal

Let a user create a brand new document inside Workshop and begin working immediately, while still supporting agent-passed links into existing documents as a separate entry path.

## Why This Matters

Right now Workshop assumes a document already exists.

That is workable in an assisted local setup.

It is not a sufficient product loop for either:

- independent use in the current web app
- the future standalone mobile app

If Workshop is a real document product, it must let the user begin.

That beginning should support at least two common intents:

- start from blank
- start from a small template or scaffold later if useful

## Product Position

Creating a document is a first-class Workshop action.

It should not feel like an admin capability.

The creation flow is the entry point into the rest of the product:

- create
- write
- collaborate
- revise
- return

If Workshop cannot own `create`, it will always feel downstream of some other tool.

## v1 Goal

Prove one simple loop:

1. user opens Workshop
2. user chooses to create a new document
3. user names it and optionally chooses a location or starter shape
4. Workshop creates the backing file and opens it immediately
5. the user can begin writing directly or asking the agent for help

If that works smoothly on phone and laptop, the product owns the beginning of the workflow.

## v1 Non-Goals

This PRD does not aim to solve:

- sophisticated template galleries
- multi-user document ownership
- cloud sync and remote storage providers
- full folder management UX
- imports from every external format
- advanced permissions
- document databases

This is a local-first create-and-open slice.

## User Story

A user can arrive in Workshop in two ways: an agent like OpenClaw can pass a link to an existing document, or the user can create a brand new document directly in Workshop.

This PRD is about the second path. The user opens Workshop, creates a new document, gives it a name, and starts working immediately.

Sometimes they write the first words themselves.

Sometimes they leave it blank and ask the agent to draft a first pass.

Either path should feel native.

## Core Product Requirements

### 1. In-App Document Creation

Workshop must offer an obvious way to create a document from within the app.

Requirements:

- the create action is discoverable from the main app flow
- the user does not need a terminal, external file creation step, or agent handoff to begin
- after creation, the new document opens directly in Workshop

### 2. Blank Document Support

The user must be able to create a truly blank document.

Requirements:

- blank means minimal or empty content, not forced boilerplate
- the document is still valid enough for Workshop to open and manage
- the user can immediately type into it or ask the agent to build a first draft

### 3. Safe Naming and Storage

Workshop must create a real backing file safely.

Requirements:

- document naming should produce a stable path or slug
- invalid names should be handled cleanly
- collisions should surface clearly and avoid accidental overwrite
- the storage location should fit the local-first model

### 4. Fast Start After Creation

Document creation should flow directly into work.

Requirements:

- the document opens immediately after creation
- the user can enter manual edit mode or discussion mode right away
- the empty-state copy should support a fresh-document workflow

### 5. Future-Friendly for Mobile

The web flow should not assume desktop-only patterns.

Requirements:

- the create flow should make sense in a constrained mobile UI
- it should not depend on drag-and-drop or file-picker complexity
- the interaction should foreshadow a native mobile create experience

## Product Flows

### Flow 1: Create Blank Document

1. user taps `New document`
2. user enters a title
3. Workshop creates the file
4. Workshop opens the new document
5. the user starts writing or asks the agent to draft

Success criteria:

- the path from idea to open document feels immediate

### Flow 2: Create Then Dictate

1. user creates a new document on phone
2. user enters edit mode
3. user dictates rough text into the blank document
4. user saves
5. user asks the agent to clean it up

Success criteria:

- creation supports the rapid capture workflow, not just formal authoring

### Flow 3: Create Then Ask Agent For First Draft

1. user creates a blank document
2. user leaves it mostly empty
3. user asks the agent to produce a first draft or outline
4. Workshop uses the normal proposal/discussion flow from there

Success criteria:

- a blank document can still be a useful starting surface for agent-led drafting

## UX Requirements

The create flow should feel lightweight.

Required visible elements:

- clear `New document` action
- title input
- create confirmation action
- helpful first-open empty state

Nice to avoid in v1:

- too many required metadata fields
- file-system jargon
- heavyweight setup screens
- creation dialogs that feel like project management software

The experience should feel like:

- starting a fresh page in a focused writing tool

not:

- provisioning a resource in an admin panel

## Technical Requirements

### 1. File-Backed Creation

Workshop must create a real document file that fits the current file-backed architecture.

### 2. Consistent Artifact Initialization

New documents should start with predictable Workshop metadata and no broken assumptions around comments, proposals, or revisions.

### 3. Recents Integration

Newly created documents should appear naturally in recents and become part of the standard open/reopen flow.

### 4. Safe Path Handling

The server must sanitize and validate document creation paths to avoid unsafe writes.

## Open Questions

- Should v1 support only blank documents, or also one or two small starter templates?
- Should document title and file name be tightly coupled in v1?
- Should a newly created blank document include a placeholder heading, or truly no content?
- Should creation happen in one default folder or allow folder choice?

## Product Test

This PRD is satisfied when all of the following are true:

- a user can create a new document entirely from within Workshop
- the result is a real backing file
- the new document opens immediately
- the user can start writing directly or asking the agent for help
- the flow works comfortably in the current web app and points cleanly toward a future mobile shell
