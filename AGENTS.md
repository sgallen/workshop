# AGENTS.md

This repo should stay tightly aligned to one problem:

How should a human and an agent refine a document together once chat stops being enough?

## Purpose

Workshop is a local-first collaboration surface for human-agent iteration on documents.

The initial focus is Markdown-first refinement, with room for richer artifact types later.

## Non-Negotiable Constraints

- Keep the document at the center, not the chat transcript.
- Keep real files as the source of truth.
- Keep the experience usable from a phone.
- Keep the system local-first and Tailscale-friendly.
- Do not let the project bloat into a general workspace platform.
- Do not add speculative complexity before the core interaction is proven.

## Product Lens

Workshop should feel like:

- a focused working mode
- a linkable collaboration surface
- a place to comment, revise, and review in context

It should not feel like:

- a generic AI shell
- a project-management tool
- a full Google Docs clone
- a broad multimodal creative suite

## Core Interaction

The key move is:

1. a conversation produces or identifies a document
2. the agent opens that document in Workshop
3. the human follows a link into the focused workspace
4. comments and revisions happen there
5. changes apply to the underlying file

If a change does not improve that loop, be skeptical of it.

## v0 Bias

Prefer:

- Markdown first
- section-level comments
- clean rendered reading view
- source-aware structure
- simple revision proposals and diffs
- a narrow local server/web app

Avoid:

- generalized plugin systems
- multi-user enterprise abstractions
- premature image editing
- complex auth schemes beyond what local/Tailscale usage needs
- trying to support every artifact type at once

## Decision Filter

Before adding something, ask:

1. Does this make document refinement between a human and an agent better?
2. Does this help on phone as well as laptop?
3. Does this preserve a simple mental model?
4. Does this keep the document and file real?
5. Is this solving a concrete pain we actually hit?

If not, the default answer is no.

## Docs Split

- `README.md`: public-facing product framing
- `docs/project-brief.md`: internal rationale, UX spine, and scope discipline

Keep both current. If the product idea shifts, update both.

## Architecture Direction

- The current shell is a local web app plus a TypeScript server.
- The longer-term target is `shared core + multiple shells`, not a permanent one-off web implementation.
- Durable product logic should move toward shared core modules for documents, proposals, revisions, recents, and section semantics.
- Runtime-specific behavior should stay in adapters.
- Web/OpenClaw-invoked and future native shells should consume the same product model instead of re-implementing it.

## Current Execution Order

Work the repo in this order unless a strong reason appears to change it:

1. tighten the shared core seams
2. get the web agent-document loop working well
3. only then begin the first-class native shell work

Do not let native ambitions derail the near-term goal of proving the document-first web loop.

## Runtime Guardrails

- Treat `server/server.ts` as the authoritative backend entrypoint.
- Do not reintroduce or rely on a parallel legacy `server/server.mjs` runtime.
- Remember that `vite preview` serves the built frontend only; auth and agent APIs still depend on the TypeScript backend being up separately.
- When changing auth, agent actions, or API routes, verify the live process is actually the TS server before drawing conclusions from the UI.
