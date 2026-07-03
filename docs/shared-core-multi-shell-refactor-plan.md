# Workshop Shared Core + Multiple Shells Refactor Plan

## Purpose

Define the refactor path that lets Workshop evolve from its current single web app + local server shape into:

- a shared product core
- a web/OpenClaw-invoked shell
- a future first-class native shell

This plan is intentionally incremental.
It should improve the current web codebase now while keeping a React Native / Expo future realistic.

This doc is about architecture and execution order.
For the concrete product interaction model that the refactor should preserve, see `docs/agent-editing-v1-blueprint.md`.

## Current Reality

Today the repo is effectively shaped like this:

- `server/server.ts`
  - HTTP API
  - local store
  - path resolution
  - document loading
  - recents behavior
  - comment persistence
- `server/codex-agent.ts`
  - auth/provider integration
- `src/App.tsx`
  - UI
  - client state
  - product rules
  - recents display behavior
  - document/session interaction logic

That is fine for v0 speed, but it mixes together:

- product/domain logic
- runtime adapters
- transport/API logic
- UI state

If we keep building that way, a native app will force a near-rewrite.

## Target Architecture

Workshop should evolve toward three layers:

1. `core`
2. `adapters`
3. `shells`

## 1. Core

The core should contain product/domain logic that does not care whether the surface is:

- web
- OpenClaw-invoked web
- future iOS/Android app

The core should own:

- document metadata model
- proposal set model
- revision/checkpoint model
- recents ordering rules
- apply/dismiss/undo/restore semantics
- section parsing and anchoring rules
- conversation/proposal/revision state transitions

The core should not know about:

- Express
- Vite
- React DOM
- React Native
- file picker APIs
- Node-only filesystem calls
- HTTP request objects

## 2. Adapters

Adapters translate the core's needs into concrete platform/runtime behavior.

Initial adapters:

- `filesystem-node`
- `store-node-local`
- `agent-runtime-codex-node`
- `document-loader-markdown-node`

Likely future adapters:

- `filesystem-native`
- `store-native-local`
- `document-import-native`
- maybe `agent-runtime-remote` if mobile later talks to a local/remote agent service

Adapters should own:

- reading/writing real files
- resolving paths
- persisting local app state
- auth credential storage
- provider/runtime invocation
- link/open handoff behavior

## 3. Shells

Shells are user-facing application surfaces.

Initial shell:

- current web app + local server

Future shell:

- Expo/React Native app

Shells should own:

- navigation
- presentation
- shell-specific input/output flows
- UI state wiring
- calling adapters/core use cases

Shells should not redefine the product model.

## Design Principle

Do not port the current app wholesale into React Native later.

Instead:

- extract the durable Workshop product model now
- keep web-specific and Node-specific code at the edges
- let future shells reuse the same use cases and domain rules

This refactor exists to support the document-first agent workflow, not to distract from it.

## What To Extract First

Refactor order matters.
Do not try to extract everything at once.

### First Extraction Targets

These are the highest-leverage shared-core seams:

1. `recents ordering rules`
2. `document metadata state`
3. `revision/checkpoint semantics`
4. `proposal set + proposal item types`
5. `apply/dismiss/undo/restore rules`
6. `section parsing / section identity rules`

These are currently the most likely to be needed identically across web and native.

### Keep In Adapters For Now

Do not prematurely abstract these:

- Express route wiring
- Codex auth process spawning
- Vite/server startup details
- browser-specific scroll/focus behavior
- mobile-specific gesture/navigation concerns

## Proposed Repo Shape

Not all folders need to appear immediately, but this is the intended direction.

```text
workshop/
  docs/
  server/
    routes/
    adapters/
  src/
    web/
  core/
    documents/
    proposals/
    revisions/
    recents/
    sections/
    conversation/
  adapters/
    filesystem-node/
    store-node-local/
    agent-runtime-codex-node/
```

Possible later native repo shape:

```text
workshop-native/
  app/
  adapters/
    filesystem-native/
    store-native-local/
  shared/
    -> consumes Workshop core package
```

Whether native lives in the same repo or a sibling repo can be decided later.
The immediate goal is to make that choice possible.

## Practical Phase Plan

## Phase 1: Extract Domain Types

Goal:

- stop treating `App.tsx` and `server.ts` as the canonical definition of product state

Actions:

- create shared TypeScript types for:
  - document metadata
  - recent-document summary
  - section identity
  - proposal set
  - proposal item
  - revision snapshot
  - conversation turn

Result:

- UI and server both import the same types
- product state stops drifting by surface

## Phase 2: Extract Pure Domain Helpers

Goal:

- move product logic into testable pure functions

Actions:

- extract helpers for:
  - deriving recents from document metadata
  - preserving active-document visibility in the drawer without reordering
  - apply/dismiss/accept-all state transitions
  - revision/restore state transitions
  - section anchoring lookups

Result:

- the most fragile product rules no longer live inline in React components or route handlers

## Phase 3: Extract Store Boundary

Goal:

- replace ad hoc JSON-shape handling inside `server.ts` with a real storage boundary

Actions:

- define an internal store interface for:
  - list documents
  - load document metadata
  - save document metadata
  - list revisions
  - append revision
  - load/save conversation state
  - load/save proposal state

- implement it first with the current local JSON store

Result:

- current local storage still works
- future SQLite/native/local-device storage becomes possible without rewriting product logic

## Phase 4: Extract Document Service

Goal:

- separate file-backed document operations from HTTP and UI concerns

Actions:

- create a document service/use-case layer that handles:
  - open-or-resume document
  - load canonical markdown
  - parse sections
  - derive view model inputs
  - create initial checkpoint when first seen

Result:

- web server routes become thinner
- native shell later has a clear use-case layer to call

## Phase 5: Extract Agent Turn Service

Goal:

- make the future agent loop shared at the product layer, not buried in route handlers

Actions:

- define one shared use case like:
  - `runAgentTurn(documentContext, userTurn, focusContext)`

- return:
  - discussion messages
  - optional proposal set

- keep Codex-specific invocation in an adapter

Result:

- the web shell and native shell can both drive the same product turn semantics

## Phase 6: Thin The Web Shell

Goal:

- make `src/App.tsx` a consumer of the shared product model rather than the place where product rules are invented

Actions:

- move inline logic out of `App.tsx`
- keep `App.tsx` focused on:
  - calling APIs
  - presentation state
  - rendering document/rail/history surfaces

Result:

- web stays better structured
- native implementation later has a cleaner example to mirror

## What We Should Not Do Yet

Avoid these premature moves:

1. do not create a giant abstract plugin system
2. do not create a generic provider registry
3. do not prematurely optimize for monorepo package publishing
4. do not solve every mobile file-management detail now
5. do not rewrite the whole app into some new framework just to feel "architectural"

This refactor should support the next real task:

- getting the web agent-document loop working well

## Native-App Implications

This refactor plan is intentionally chosen to make a future Expo/React Native app practical.

What native should be able to reuse:

- document/proposal/revision/recents domain logic
- section parsing rules
- proposal and revision state transitions
- product semantics around apply/dismiss/undo/restore

What native will likely need its own implementation for:

- file import/open flows
- local filesystem/storage details
- shell navigation
- offline/background behavior
- native credential handling

## Recommended First Native Storage Assumption

Do not assume v1 native must support arbitrary external-folder editing like a full Obsidian vault.

Safer first assumption:

- import/open files into app-managed local storage
- keep Workshop metadata and revisions locally
- export/share when needed

This should remain an adapter-level choice, not a core product constraint.

## Success Criteria For This Refactor

The refactor is succeeding when:

1. the current web app remains functional
2. product rules move out of `App.tsx` and `server.ts`
3. recents/proposals/revisions are defined once in shared code
4. the next web agent-loop work becomes easier, not harder
5. a future native shell is plausible without redefining Workshop's product model

## Immediate Next Execution Slice

Do not attempt the whole refactor in one pass.

The next concrete slice should be:

1. create shared domain/type modules
2. extract recents derivation into shared pure logic
3. extract store access behind a small interface
4. update web/server code to consume those seams

That is enough to establish the architectural direction without stalling product progress.
