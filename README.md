# Workshop

Workshop is the native way to workshop documents with an agent.

It exists for the moment when chat stops being the right place to work and the document itself becomes the center of gravity.

## Core Idea

Chat is good for starting.

Chat is often bad for refining.

Once there is a real draft, brief, proposal, note, or plan, revision work should move into a document-first workspace where a human and agent can shape the artifact together.

That is what Workshop is for.

## Product Position

Workshop is its own product.

It should own its own document workshopping loop, its own agent/runtime contract, and its own user experience.

Other systems can hand work into Workshop, but they should not sit in the middle of every document turn once the user has entered the workspace.

OpenClaw is an important example:

- OpenClaw can know Workshop exists
- OpenClaw can help set it up or expose it
- OpenClaw can open or resume a document in Workshop
- OpenClaw can return the right link when a user says things like "Let's workshop this doc"

But Workshop should still own the actual document loop.

## The Shift

The intended flow is:

```text
talk in chat
↓
a real document becomes the center of gravity
↓
an agent or tool opens that document in Workshop
↓
the human jumps into a focused document workspace
↓
the human comments, directs, and reviews in context
↓
Workshop runs its own agent loop against the document
↓
the pair iterate until the document is ready
```

The key point is that the handoff into Workshop should be thin, but once the user is inside Workshop, the product should feel self-contained and document-first.

## Why It Needs To Exist

Current chat surfaces are weak for iterative document work with agents.

The problems show up quickly:

- the conversation stays primary while the document stays secondary
- long Markdown documents are awkward to review in chat
- comments lose their exact section context
- revision requests get scattered across message history
- agent output is harder to inspect in document form
- phone-based refinement is especially clumsy

Workshop exists to make document refinement feel natural instead of improvised.

## What Workshop Is

Workshop is:

- document-centered
- local-first by default
- file-backed
- agent-native
- linkable
- comfortable on phone and laptop
- focused on refinement rather than generic chat

The first-class objects are things like:

- document
- section or region
- comment thread
- proposed revision
- applied revision
- session link

## What Workshop Is Not

Workshop is not:

- a general chat replacement
- a generic AI sidebar beside an editor
- a full office suite
- a broad multi-agent orchestration platform
- a general workflow or project-management tool

If it tries to become all of those things, it will lose the product clarity that makes it useful.

## Architecture Direction

There are two separate seams:

1. External handoff seam
2. Internal agent seam

The external handoff seam is for things like OpenClaw.

That contract should stay small:

- input: a real document path or identifier
- optional input: title, source metadata, resume intent
- output: a stable Workshop URL for the active document session

The internal agent seam belongs to Workshop.

That contract needs to answer things like:

- how Workshop represents an authenticated agent identity
- how Workshop knows an agent is available
- how Workshop issues a request against a document or section
- whether results come back as critique, replacement text, diff, patch, or full revision
- how those results are rendered in a document-first way

OpenClaw is useful inspiration for auth and runtime patterns, especially around OpenAI ChatGPT/Codex OAuth, but Workshop should still own its own loop and runtime contract.

## v0 Focus

Workshop should start narrow.

The first version should prove a real end-to-end document loop for:

- Markdown documents
- a local web app
- rendered reading view plus source-aware structure
- section-level comments
- narrow, useful agent actions
- revisions against the real underlying file
- diffs and revision history
- phone-friendly access
- simple link-based handoff from chat or another tool

Useful first agent actions are likely:

- improve clarity
- rewrite this section
- tighten structure
- critique this draft
- propose a better outline
- expand this area

## Core Promise

Workshop is not trying to replace chat.

It is trying to provide a better mode once the output matters.

The promise is:

- start in chat
- shift into a focused document workspace
- keep comments and revisions attached to the real file
- let the human steer and judge while the agent helps shape the document

## Status

Workshop is currently being shaped from real collaboration pain rather than theory.

The immediate goal is to build the smallest credible Markdown-first version that makes document workshopping with an agent genuinely better than doing the same work in chat.
