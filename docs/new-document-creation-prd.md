# Workshop New Document Creation PRD

## Purpose

Define the smallest useful product slice that lets a user create a new Markdown document from inside Workshop and start working immediately.

This PRD is for the current web app.
It should stay compatible with future native/mobile shells, but it should not broaden scope now.

## One-Line Product Goal

Let a user create a new blank Markdown document inside Workshop, open it immediately, and begin writing directly or collaborating with the agent.

## Why This Matters

Workshop currently assumes a document already exists.

That is not enough for a real document product.

Workshop should own the beginning of the workflow, not only the refinement phase.

The smallest credible beginning is:

1. create a document
2. open it immediately
3. write directly or ask the agent for help

## Product Position

Creating a document is a core Workshop action.

It should feel like starting a fresh page in the product, not like performing file management.

Workshop should support this loop:

- create
- write
- collaborate
- revise
- return

## v1 Goal

Prove one simple loop:

1. user opens Workshop
2. user taps `New document`
3. user enters a title
4. Workshop creates a real Markdown file in a default location
5. Workshop opens the document immediately
6. user can either:
   - enter manual edit mode and write
   - use the discussion rail and ask the agent for help

If that feels smooth on phone and laptop, Workshop owns the beginning of the workflow.

## v1 Non-Goals

This PRD does not include:

- template galleries
- folder picker UX
- arbitrary storage destinations
- cloud storage
- imports from external formats
- document ownership systems
- advanced metadata forms
- multi-user collaboration

This is a local-first create-and-open slice only.

## Core Product Requirements

### 1. In-App Document Creation

Workshop must provide an obvious create action inside the app.

Requirements:

- `New document` is discoverable from the left document list / recents pane
- the action feels immediate and lightweight
- the user does not need a terminal, external editor, or agent handoff to begin
- after creation, the new document opens directly in Workshop

### 2. Blank Markdown Document Creation

v1 must support creating a blank Markdown document only.

Requirements:

- v1 creates a Markdown file with a minimal initial heading:
  - `# <Title>`
- the document must open cleanly in Workshop’s current document view
- the user can immediately continue in manual edit mode or discussion mode

Notes:

- v1 does not include alternate starter templates
- v1 does not create a truly empty file

### 3. Safe Naming and Storage

Workshop must create a real backing file safely.

Requirements:

- the user provides a title
- Workshop derives the file name from the title
- the file name is slugified and saved as:
  - `<slug>.md`
- creation happens only inside one default allowed creation directory
- collisions must fail clearly and must not overwrite an existing file
- invalid or empty titles must fail with a clear message
- path handling must prevent unsafe writes outside the allowed workspace root

### 4. Fast Start After Creation

Creation must flow directly into work.

Requirements:

- the document opens immediately after creation
- the user remains in the normal Workshop document view
- the user can immediately:
  - enter manual edit mode
  - open the discussion rail
  - ask the agent for a first draft or outline
- first-open UI should feel calm and lightweight, not like a setup flow

### 5. Consistent File-Backed Initialization

New documents must fit the current Workshop model cleanly.

Requirements:

- the backing file exists on disk before the document opens
- the new document starts with:
  - no comments
  - no active proposals
  - no revisions yet unless implementation needs an explicit initial revision later
- the document should appear naturally in recents after creation/open

### 6. Mobile-Friendly Interaction

The create flow must work comfortably on phone.

Requirements:

- the flow works in a constrained mobile layout
- it does not rely on drag-and-drop or desktop-style file management
- it uses a simple title input plus create action
- it should feel compatible with the later native/mobile shell direction

## Product Flows

### Flow 1: Create Blank Document

1. user taps `New document`
2. user enters a title
3. Workshop creates `<slug>.md` in the default document directory
4. Workshop opens the new document
5. user starts writing or asks the agent to draft

Success criteria:

- the path from idea to open document feels immediate
- no external tool is required

### Flow 2: Create Then Write

1. user creates a new document
2. user enters manual edit mode
3. user writes or dictates rough text
4. user saves
5. user continues refining

Success criteria:

- Workshop supports rapid capture, not just review

### Flow 3: Create Then Ask Agent For First Draft

1. user creates a new document
2. user leaves the initial content mostly minimal
3. user asks the agent for a first draft or outline
4. Workshop uses the normal discussion/proposal flow

Success criteria:

- a newly created document works as a valid starting surface for agent-led drafting

## UX Requirements

The create flow should feel lightweight and obvious.

Required visible elements:

- clear `New document` action
- title input
- create confirmation action
- immediate open into the normal document view

Avoid in v1:

- file-system jargon
- folder trees
- template galleries
- extra required metadata
- project-management style setup screens

The experience should feel like:

- starting a fresh page in a focused writing tool

not:

- provisioning a resource in an admin panel

## Technical Requirements

### 1. File-Backed Creation

Workshop must create a real Markdown file on disk.

### 2. Default Creation Root

v1 must create documents only inside one server-defined default creation directory.

### 3. Safe Path Handling

The server must sanitize file names and prevent writes outside the allowed workspace root.

### 4. Collision Safety

If a file already exists at the derived path, creation must fail clearly and must not overwrite it.

### 5. Recents Integration

A newly created document must appear naturally in the recents/open flow.

## Open Questions

Later, but not required for v1:

- Should Workshop support one or two small starter templates?
- Should users eventually choose folders?
- Should title and filename be decoupled later?

## Product Test

This PRD is satisfied when all of the following are true:

- a user can create a new document entirely inside Workshop
- the result is a real Markdown file on disk
- the file is created in a safe default location
- the new document opens immediately
- the user can start writing directly or asking the agent for help
- collisions do not overwrite existing files
- the flow works comfortably in the current web app and points cleanly toward a future mobile shell
