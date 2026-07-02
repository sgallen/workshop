# Workshop v0 Technical Plan

## Goal

Prove the smallest end-to-end loop that makes document workshopping with an agent better than doing the same work in chat.

The loop is:

1. open a Markdown file for collaboration
2. get a shareable local/Tailscale link
3. open the artifact comfortably on phone
4. direct the agent against a specific section or the full document
5. let the agent revise the underlying file
6. review the updated result and revision history

## Hard Constraints

- local-first
- mobile-first
- Tailscale-friendly
- real files are the source of truth
- Markdown first
- single human + single agent is enough for v0
- the document stays primary throughout the loop

## Proposed Stack

Use a small TypeScript web app with one local server.

### Server

- Node.js
- TypeScript
- a small HTTP server framework such as Express
- file-system access to real artifacts
- a lightweight JSON or SQLite-backed local state store

### Client

- React
- TypeScript
- Vite
- mobile-first responsive UI

## Why This Stack

- easy to run locally on a laptop
- straightforward to expose over Tailscale
- good ergonomics for a phone-first web UI
- simple file and state handling
- low conceptual overhead compared with heavier full-stack frameworks

This is not the moment to optimize for SSR cleverness or a big framework.

## v0 Document Model

The first supported artifact type is Markdown.

Each artifact should have:

- canonical file path
- display title
- rendered HTML view
- section index derived from headings
- revision history

v0 should identify interaction targets by section, not arbitrary text ranges.

That is less powerful than full inline annotation, but much simpler and probably enough to prove the loop.

## v0 Data Model

### Document Session

Represents an open collaboration context for a real file.

Fields:

- `id`
- `filePath`
- `title`
- `artifactType`
- `createdAt`
- `updatedAt`

### Section

Derived from the Markdown structure.

Fields:

- `id`
- `artifactSessionId`
- `headingText`
- `level`
- `startLine`
- `endLine`

### Comment Thread

Fields:

- `id`
- `artifactSessionId`
- `sectionId`
- `status`
- `createdAt`
- `updatedAt`

### Comment

Fields:

- `id`
- `threadId`
- `authorType` (`human` or `agent`)
- `body`
- `createdAt`

### Revision

Represents a concrete proposed or applied change to the file.

Fields:

- `id`
- `artifactSessionId`
- `summary`
- `status` (`proposed`, `applied`, `rejected`)
- `diffText`
- `createdAt`

## v0 User Flows

### Flow 1: Open Existing Markdown File

1. choose a Markdown file path
2. create or resume an artifact session
3. return a stable URL
4. render the file on mobile
5. show a section list and an obvious path to direct the agent in context

### Flow 2: Direct Agent On Section

1. tap a section
2. view its existing thread or create a new one
3. ask for a change, critique, rewrite, or refinement
4. show thread state immediately

### Flow 3: Agent Applies Revision

1. agent reads comments
2. agent updates the real Markdown file
3. Workshop reparses the file
4. UI shows updated rendered content
5. revision entry and diff are recorded

## URL Shape

Keep URLs simple and stable.

- `/`
  list open or recent artifact sessions
- `/artifacts/:sessionId`
  artifact reading and commenting view
- `/artifacts/:sessionId/history`
  revisions and activity

The shareable link should usually go directly to `/artifacts/:sessionId`.

## Minimal Agent Handoff Contract

v0 needs an explicit contract for how an agent opens an artifact in Workshop.

The contract should be:

1. the caller provides a real artifact path
2. Workshop opens or resumes an artifact session for that path
3. Workshop returns a stable artifact URL
4. the human lands directly in the artifact view
5. the UI exposes document identity and revision state without exposing local-path complexity

This contract matters because the user experience should feel like:

- "open this document in Workshop"

not:

- "here is a machine-specific path and a local setup ritual"

Implications for v0:

- session identity should be stable enough for reopen/resume behavior
- path resolution belongs at the server boundary, not in the shared human-facing flow
- document metadata should support reload/revision awareness
- the returned link should be the primary object an agent shares back into chat

## Minimal Compelling v1 Agent Loop

v1 does not need a broad agent platform.

It needs one compelling loop:

1. open or create a Markdown document
2. select a section or stay at document scope
3. tell the agent what kind of help is needed
4. receive a concrete revision to the underlying file
5. review the updated document in place
6. iterate

The agent actions can stay narrow at first. Useful examples:

- improve clarity
- tighten structure
- rewrite this section
- critique the argument
- propose a better outline
- expand this area

### First Concrete Agent Actions

To keep v1 opinionated, Workshop should start with a very small action set.

Recommended first actions:

1. `critique_document`
   - Scope: whole document
   - Returns: a compact critique plus suggested next edits

2. `rewrite_section`
   - Scope: one selected section
   - Returns: replacement section text with a short rationale

3. `propose_outline`
   - Scope: whole document or selected region
   - Returns: an alternative structure or outline

4. `expand_section`
   - Scope: one selected section
   - Returns: an expanded version of the selected section

5. `summarize_open_threads`
   - Scope: current document session
   - Returns: a summary of unresolved comments and likely next moves

These actions are enough to test whether Workshop is genuinely better than chat for document refinement.

They also give the product a concrete boundary:

- not a generic "ask the agent anything" surface
- not a broad tool-using agent shell
- not a free-form prompt box with no product opinion

Each action should feel like a document-native move, not just a chat prompt in a different container.

If this loop feels better than doing the same work in chat, v0 is working.

## Mobile-First UX Shape

Default to a single-column reading view.

The main screen should prioritize:

- title
- rendered content
- section affordances
- visible comment state
- easy jump between sections

Avoid desktop-biased UI patterns such as:

- tiny sidebars
- hover-only actions
- dense multi-pane layouts by default

Desktop can enhance the layout later.

## Tailscale / Local Networking

v0 should assume the app runs on the laptop and is accessed from phone over Tailscale.

Requirements:

- bind to `0.0.0.0` in local dev when needed
- configurable port
- clear display of the shareable Tailscale URL
- no cloud dependency for the core loop

The core test is whether the link is easy to open from chat on phone and immediately useful for agent-document iteration.

## State Storage

For v0, prefer a small local SQLite database.

Reasons:

- reliable local persistence
- easy query model for sessions/comments/revisions
- better than inventing a custom file format
- extensible without becoming infrastructure-heavy

The artifact content itself still lives in real Markdown files, not in the database.

## Markdown Rendering

v0 should:

- parse headings into sections
- render Markdown cleanly for phone reading
- preserve a mapping between rendered sections and source sections

Full inline text anchoring can come later.

## Out of Scope For v0

- collaborative text editing in-browser
- multiple simultaneous humans
- generalized auth
- rich image annotation
- arbitrary DOM region annotation
- cloud sync
- generic agent marketplace behavior
- generalized chat inside the app

## Initial Implementation Order

1. Set up the app shell and local server.
2. Add open/resume artifact session support for Markdown files.
3. Parse Markdown into sections.
4. Build the mobile-first artifact page.
5. Add section comment threads.
6. Add revision history and file reparse on change.
7. Add a clean link-sharing flow for local/Tailscale use.

## Success Criteria

v0 is successful if:

- a Markdown file can be opened as a Workshop artifact
- the phone reading experience is comfortable
- a human can comment on a section in context
- an agent can revise the underlying file
- the updated result is visible immediately
- this is plainly better than trying to do the same work in chat
