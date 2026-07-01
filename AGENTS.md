# AGENTS.md

This repo should stay tightly aligned to one problem:

How should a human and an agent refine an artifact together once chat stops being enough?

## Purpose

Workshop is a local-first collaboration surface for human-agent iteration on artifacts.

The initial focus is Markdown-first refinement with a path to HTML artifacts later.

## Non-Negotiable Constraints

- Keep the artifact at the center, not the chat transcript.
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

1. a conversation produces or identifies an artifact
2. the agent opens that artifact in Workshop
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

1. Does this make artifact refinement between a human and an agent better?
2. Does this help on phone as well as laptop?
3. Does this preserve a simple mental model?
4. Does this keep the artifact and file real?
5. Is this solving a concrete pain we actually hit?

If not, the default answer is no.

## Docs Split

- `README.md`: public-facing product framing
- `docs/project-brief.md`: internal rationale, UX spine, and scope discipline

Keep both current. If the product idea shifts, update both.
