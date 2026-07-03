# Workshop Shared Core + Multiple Shells Refactor Plan

## Purpose

Define the smallest refactor path that lets Workshop evolve from its current web-first shape into:

- a shared local-first product core
- a hosted local runtime
  - for example, Workshop installed on an OpenClaw machine and accessed over Tailscale
- a future device-local runtime
  - for example, a React Native / Expo app on phone

This plan is intentionally incremental.
It should improve the current web codebase now without overcomplicating the repo.

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
- runtime-specific logic
- transport/API logic
- UI state

If we keep building that way, a future device-local app will force a near-rewrite.

## Local-First Runtime Assumption

Workshop should currently be designed around two local runtime shapes:

1. `hosted local runtime`
   - Workshop runs on a machine
   - the human may reach it locally or over Tailscale
   - that machine may also host the local files and the connected agent runtime

2. `device-local runtime`
   - Workshop runs directly on the phone
   - no separate Workshop server is required
   - the app manages its own local state and document interaction

A later server-backed mode for sync, collaboration, backup, or remote execution is possible.
But that is not the foundation we should optimize around yet.

## Target Architecture

Workshop should evolve toward three practical layers:

1. `core`
2. `runtime edges`
3. `shells`

## 1. Core

The core should contain product logic that does not care whether Workshop is running:

- in the hosted local web runtime
- in a future device-local native runtime
- or later in a server-assisted mode

The core should own:

- document metadata model
- section parsing and section identity rules
- recents ordering rules
- discussion/message model
- proposal set model
- revision/checkpoint model
- apply/dismiss/undo/restore semantics
- agent-turn input/output shapes

The core should not know about:

- Express
- HTTP request/response objects
- Vite
- React DOM
- React Native
- Node-only filesystem calls
- phone file pickers
- cloud/server persistence assumptions

## 2. Runtime Edges

Runtime edges translate core needs into the concrete local environment.

Examples in the current hosted local runtime:

- Node filesystem access
- local JSON persistence
- Codex auth/runtime invocation
- path resolution
- web/Tailscale handoff behavior

Examples in a future device-local runtime:

- phone file import/open behavior
- on-device local storage
- native credential handling
- device-side agent/runtime wiring

These should stay runtime-specific until there is a concrete reason to unify them.

## 3. Shells

Shells are the user-facing application surfaces.

Current shell:

- web app + local TypeScript server

Future shell:

- React Native / Expo app

Shells should own:

- navigation
- presentation
- shell-specific input/output flows
- UI state wiring

Shells should not redefine the product model.

## Design Principle

Do not over-abstract early.

The goal is not to invent a grand framework for every future runtime.
The goal is simply to avoid hard-coding Workshop's product rules into the current web implementation.

This means:

- move durable product rules into shared code
- keep runtime-specific behavior at the edges
- avoid extracting code that only makes sense for Express or only for the browser

## What To Extract First

Refactor order matters.
Do not try to extract everything at once.

### First Extraction Targets

These are the highest-leverage seams to share first:

1. `shared domain types`
2. `recents ordering and visibility rules`
3. `section parsing / section identity rules`

These are the most likely to be needed identically across:

- hosted local web runtime
- future device-local native runtime
- possible later server-assisted runtime

### Keep Runtime-Specific For Now

Do not prematurely abstract these:

- Express route wiring
- Codex auth process spawning
- Vite/server startup details
- browser-specific scroll/focus behavior
- mobile-specific gesture/navigation behavior
- sync/collaboration transport ideas

## Minimal Repo Direction

Not all folders need to appear immediately, but this is the intended direction.

```text
workshop/
  docs/
  server/
  src/
  core/
    documents/
    recents/
    sections/
    conversation/
    proposals/
    revisions/
```

The immediate point is not package architecture.
The point is to establish a small shared layer that is not web-only.

## Practical Phase Plan

## Phase 1: Extract Shared Domain Types

Goal:

- stop treating `App.tsx` and `server.ts` as the canonical definition of product state

Actions:

- create shared TypeScript types for:
  - document metadata
  - recent-document summary
  - section identity
  - comment / discussion message
  - proposal set
  - proposal item
  - revision snapshot
  - conversation turn

Result:

- UI and server both import the same types
- product state stops drifting by surface

## Phase 2: Extract Pure Product Helpers

Goal:

- move reusable product logic into testable pure functions

Actions:

- extract helpers for:
  - deriving recents from document metadata
  - preserving active-document visibility in the drawer without reordering
  - parsing markdown sections
  - resolving section identity/anchoring lookups

Result:

- the most fragile cross-runtime rules no longer live inline in React components or route handlers

## Phase 3: Thin Current Runtime Code

Goal:

- make the current hosted local web runtime a consumer of shared product logic rather than the place where those rules are invented

Actions:

- update `server/server.ts` to consume shared section and recents logic
- update `src/App.tsx` to consume shared types and simpler derived helpers
- keep file IO, auth/runtime calls, and route wiring where they are for now

Result:

- the current app stays simple
- the product model becomes less tied to web-only assumptions

## Phase 4: Extract More Shared Product Semantics

Only do this once the need is real.

Likely next shared candidates:

- discussion / agent-turn shapes
- proposal/revision types
- apply/dismiss/undo/restore state transitions

## What We Should Not Do Yet

Avoid these premature moves:

1. do not create a giant abstract adapter framework
2. do not create a generic provider registry
3. do not prematurely optimize for monorepo package publishing
4. do not solve every native file-management detail now
5. do not design a sync/collaboration backend before it exists
6. do not rewrite the whole app into some new framework just to feel "architectural"

This refactor should support the next real task:

- getting the web agent-document loop working well

## Native-Local Implications

This plan is intentionally chosen to make a future React Native / Expo app practical without assuming it talks to a Workshop server.

What native should be able to reuse:

- document/section/recents domain logic
- discussion/product state shapes
- proposal and revision state transitions
- product semantics around apply/dismiss/undo/restore
- agent-turn input/output shapes

What native will likely need its own implementation for:

- file import/open flows
- on-device local storage
- shell navigation
- offline/background behavior
- native credential handling
- local agent/runtime wiring

## Future Server-Assisted Possibility

There may later be value in optional services for:

- synchronization
- collaboration
- backup
- remote execution

If that happens, those services should plug into Workshop as additional runtime edges rather than become the definition of the product model.

For now, the safe assumption is:

- the product is local-first
- the runtimes differ
- the core stays shared

## Success Criteria For This Refactor

The refactor is succeeding when:

1. the current web app remains functional
2. product rules move out of `App.tsx` and `server.ts`
3. shared code is useful to both hosted-local and device-local futures
4. the next web agent-loop work becomes easier, not harder
5. a future native shell is plausible without redefining Workshop's product model

## Immediate Next Execution Slice

Do not attempt the whole refactor in one pass.

The next concrete slice should be:

1. create shared domain/type modules
2. extract recents derivation into shared pure logic
3. extract section parsing into shared pure logic
4. update current web/server code to consume those seams

That is enough to establish the direction without stalling product progress or overcomplicating the codebase.
