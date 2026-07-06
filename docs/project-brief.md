# Workshop Project Brief

## One-Line Description

Workshop is the native way to workshop documents with an agent.

## Core Insight

Chat is a good place to start a doc.

It is often a bad place to refine.

The moment a conversation turns into a real document, the center of gravity should move from the chat thread to the document itself.

That is the core reason Workshop should exist.

## Core Promise

Start with intent. Shift into a focused document workspace where a human and agent can shape the document together.

## Problem

Current chat surfaces are weak for iterative document work with agents.

Problems include:

- chat tools make the conversation primary and the document secondary
- long Markdown documents are awkward to review or direct in chat
- comments are detached from the exact section they refer to
- revision requests get scattered across message threads
- agent output is hard to inspect or refine in document form
- phone-based iteration is especially clumsy

The result is that document work becomes slow, fuzzy, and frustrating just when clarity matters most.

## Primary User Stories

### 1. Idea -> draft -> document workshop

A human comes with an idea.

The human and agent discuss it in chat.

The agent produces an initial document draft.

The pair then decide the document needs real iteration.

The agent shares a link to Workshop.

The human opens the link on phone or laptop and comments on specific sections or regions.

The agent revises the actual underlying file.

The pair continue until the document is polished.
Discussion continuity survives across turns instead of resetting every time the agent responds.

### 2. Existing document -> refinement

A human comes with an existing Markdown file and says, in effect, "let's refine this."

The agent opens it in Workshop and shares a link.

The human reviews, comments, and steers changes in context.

The agent updates the real file.

Revision history stays attached to the document instead of being lost inside chat.
The human can inspect that history directly from the document view, including lightweight `Undo last` and per-revision `Restore` actions.
If the human wants a one-question-at-a-time review flow, that discussion mode should persist until the human changes it.

## Product Shape

Workshop should be:

- local-first
- document-centered
- agent-native
- file-backed
- linkable
- usable from phone or laptop
- comfortable for a human-agent pair

The first-class objects are likely:

- document
- section or region
- comment thread
- proposed revision
- applied revision
- session link

This is a native document workshop, not just a viewer and not just another chat UI.

## Local Runtime Direction

Workshop should be designed so the same product can live in more than one local runtime shape.

The two important shapes are:

1. a hosted local runtime
   - Workshop runs on a machine
   - the human may reach it locally or over Tailscale
   - that machine may also host the local files and the connected agent runtime

2. a device-local runtime
   - Workshop runs directly on the phone
   - the app manages its own local state and document interaction
   - no separate Workshop server is required

The current implementation is the first shape.

That should not be mistaken for the permanent product boundary.

The long-term product should preserve:

- one shared document-first product model
- more than one local runtime shell
- optional future server-assisted services for sync, collaboration, backup, or remote execution

Those later services may become useful, but they are not the foundation that v0 should optimize around.

## Product Principles

- the document is the center of gravity
- the agent is essential to the workflow
- the human keeps final judgment
- the product should feel native on phone and laptop
- local-first is the default
- provider and agent runtime should remain pluggable

## v0 Scope

The initial version should stay narrow and useful.

Focus on:

- Markdown documents first
- local web app
- rendered reading view
- source-aware structure
- section-level comments
- section-aware agent interaction
- agent revisions to the underlying file
- diffs and revision history
- Tailscale-friendly access
- simple link-based handoff from chat

In the current v0 loop, revision state should stay explicit from the document view itself:

- the document header should keep identity and revision cues visible
- a compact `View history` panel should stay one tap away instead of becoming a separate workspace
- the latest revision summary should reopen history directly
- `Undo last` and direct per-revision `Restore` should be easy to find
- on phone-sized layouts, revision rows and document controls should stack cleanly rather than crowding into one forced line
- recent discussion should stay in turn context so clarifying-question workflows do not collapse into stateless prompt/response turns

The key thing v0 must prove is not "can we render docs nicely."

It must prove:

- a human wants to workshop a real document in this surface
- agent-directed iteration feels more natural here than in chat
- the document remains primary throughout the loop

## First Concrete Agent Actions

The first version should prove a tight, opinionated action set instead of a generic agent surface.

Recommended v1 actions:

- `critique_document`: give document-level feedback and next steps
- `rewrite_section`: replace one selected section with stronger text
- `propose_outline`: suggest a better structure for the document or selected region
- `expand_section`: deepen a thin section in place
- `summarize_open_threads`: condense unresolved comment threads into a next-pass plan

These actions are enough to validate the product thesis:

- the document stays primary
- the agent remains useful
- the human can steer concrete revisions from inside the document

If these actions work well, Workshop is proving a real product shape rather than just accumulating UI polish.

## Future Product Possibilities

After the Markdown-first agent-document loop works well, likely product expansion is:

1. richer agent actions against sections and full documents
2. cross-device continuity, sync, and backup
3. collaboration and shared document workflows
4. richer region targeting and additional document types

That order matters. The agent-document loop solves the current pain most directly and with the least scope risk.

## Non-Goals

- not a chat replacement
- not a general knowledge base
- not a full office suite
- not a generic project-management platform
- not a generic editor with AI bolted on
- not a broad multimodal creation tool from day one

## Product Test

If a human can move from chat into Workshop, direct an agent against a real document, and productively steer revisions from phone or laptop, the product is solving something real.

If the experience still feels like "chat, but slightly different," or "an editor with an assistant sidebar," it is missing the point.

## Why This Is Worth Building

This is useful for us, but it should not only be for us.

The broader opportunity is a general human-agent document pattern:

- chat to initiate
- document workspace to refine
- agent helps shape the doc
- real files sit underneath
- local-first by default

That pattern should be relevant for many human-agent pairs without becoming a bloated universal platform.

## Working Direction

Build the smallest credible version that makes Markdown-first document workshopping with an agent genuinely better than doing the same work in chat.
