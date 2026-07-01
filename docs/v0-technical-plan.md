# Workshop v0 Technical Plan

## Goal

Prove the smallest end-to-end loop that makes artifact refinement better than doing the same work in chat.

The loop is:

1. open a Markdown file for collaboration
2. get a shareable local/Tailscale link
3. open the artifact comfortably on phone
4. comment on a specific section
5. let the agent revise the underlying file
6. show the updated result and revision history

## Hard Constraints

- local-first
- mobile-first
- Tailscale-friendly
- real files are the source of truth
- Markdown first
- single human + single agent is enough for v0

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

## v0 Artifact Model

The first supported artifact type is Markdown.

Each artifact should have:

- canonical file path
- display title
- rendered HTML view
- section index derived from headings
- revision history

v0 should identify comment targets by section, not arbitrary text ranges.

That is less powerful than full inline annotation, but much simpler and probably enough to prove usefulness.

## v0 Data Model

### Artifact Session

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
5. show a section list and comment affordance

### Flow 2: Comment On Section

1. tap a section
2. view its existing thread or create a new one
3. add a comment
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

The core test is whether the link is easy to open from Telegram on phone and immediately useful.

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
