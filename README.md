# Workshop

Workshop is the native way to workshop documents with an agent.

It is for the moment when chat has done its job, a real draft exists, and the work now belongs in the document.

## The Pitch

Chat is good for starting.

Chat is often bad for refining.

Once you have a brief, proposal, plan, note, or draft worth shaping, the center of gravity should move from the chat thread to the document itself. Workshop gives a human and an agent a focused place to do that work together.

## Why It Should Exist

Current chat tools break down when document work gets real:

- the conversation stays primary while the document stays secondary
- long drafts are awkward to review or steer
- feedback gets scattered across messages
- comments lose section context
- agent output is harder to evaluate in document form
- phone-based iteration is especially clumsy

Workshop exists to make document refinement feel natural instead of improvised.

## How It Works

The flow is simple:

```text
talk in chat
↓
a real document emerges
↓
open it in Workshop
↓
review and comment in context
↓
direct the agent against the document
↓
iterate until the draft is strong
```

Workshop can be opened from another tool such as OpenClaw, but once the document is active, Workshop owns the document loop. It should feel like a real product, not a thin viewer bolted onto chat.

## What Makes It Different

Workshop is:

- document-first
- agent-native
- file-backed
- local-first by default
- linkable
- comfortable on phone and laptop

This is not a chat replacement, a generic AI sidebar, or a full office suite. It is a focused environment for refining real documents with agent help while keeping the human in charge.

## v0 Focus

The first version should stay narrow and prove the core loop well:

- Markdown documents
- a local web app
- rendered reading view with source-aware structure
- section-level comments
- a small set of high-value agent actions
- revisions against the real underlying file
- diffs and revision history
- simple link-based handoff from chat or another tool

The first useful actions are likely:

- critique this draft
- rewrite this section
- improve clarity
- tighten structure
- propose a better outline
- expand this area

## Product Shape

Workshop should stand on its own.

It can take inspiration from OpenClaw's auth and runtime patterns, and tools like OpenClaw should be able to hand documents into it cleanly. But Workshop should own its own agent/runtime contract and its own document-first user experience.

That separation matters:

- external tools handle discovery and handoff
- Workshop handles the actual workshopping loop

## The Test

Workshop is succeeding if a human can move from chat into a document, steer an agent in context, and get to a stronger draft faster than they could in chat alone.

If it still feels like "chat, but with a document beside it," it is missing the point.
