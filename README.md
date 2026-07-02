# Workshop

Workshop is a local-first collaboration surface for humans and agents to refine artifacts together.

Start in chat. Shift into a focused artifact workspace when the idea becomes real.

## What It Does

Workshop is for the moment when a conversation stops being just a conversation and turns into something you want to shape:

- a product brief
- a note
- a plan
- a proposal
- an HTML artifact
- eventually, maybe an image

Instead of smearing revision work across chat, Workshop gives the human and the agent a shared place to iterate on the artifact itself.

## Why

Chat is good for starting.

Chat is often bad for refining.

That becomes obvious when:

- the artifact is longer than a few paragraphs
- you want to comment on a specific section
- you want to see rendered output
- you want revision history tied to the file
- you are on your phone and need a clean focused view

Workshop exists to bridge that gap.

The intended flow is:

```text
talk in chat
↓
an artifact becomes the center of gravity
↓
agent shares a link
↓
human opens a focused workspace
↓
human comments on the artifact in context
↓
agent revises the real underlying file
↓
both iterate until it is ready
```

## Core Promise

Workshop is not trying to replace chat.

It is trying to provide a better working mode once the output matters.

The promise is simple:

- start in chat
- switch to a focused collaboration surface
- keep the artifact, comments, and revisions attached to the actual file

## Minimal Handoff Contract

For v0, the agent-to-Workshop handoff should stay brutally simple.

The contract is:

1. the agent identifies a real artifact file
2. the agent asks Workshop to open or resume that artifact as a session
3. Workshop returns a stable artifact URL
4. the human opens that URL directly into the artifact view
5. the human does not need to reason about local paths, repo roots, or shell commands

What the human should see:

- a clean artifact title
- rendered content
- visible comment and revision state
- a stable shareable link

What the human should not need to see:

- absolute file paths
- repo-internal path conventions
- laptop-specific setup details
- any distinction between "open file" and "resume session" beyond whether the artifact is already there

What the agent must preserve:

- the underlying file remains the source of truth
- the handoff link stays artifact-centered, not chat-centered
- reopening an artifact prefers resuming the same session shape when possible
- file changes outside the page can be detected and surfaced clearly

## v0 Focus

Workshop should start narrow.

First:

- Markdown documents
- local-first web UI
- link-based handoff from chat to workspace
- section-level comments
- agent-driven revisions
- rendered view plus source-aware structure
- diffs and revision history
- phone-friendly access over Tailscale

Later:

- HTML artifacts
- richer block/region targeting
- image review and feedback

## What Workshop Is Not

Workshop is not:

- a generic chat replacement
- a full collaborative office suite
- a visual design tool
- a general workflow platform
- a multi-agent orchestration product

If it starts trying to do everything, it will stop being useful for the actual problem.

## Design Principles

- Local-first by default.
- Real files stay the source of truth.
- The artifact is the first-class object.
- Comments should attach to sections, blocks, or regions, not float as vague chat blobs.
- The human should not need to understand repo structure or file paths to collaborate.
- The workflow should feel natural on both phone and laptop.

## Primary User Stories

### 1. Idea -> artifact -> refinement

- A human brings an idea in chat.
- An agent creates an initial artifact.
- The agent shares a link to a focused workspace.
- The human reviews and comments in context.
- The agent revises the underlying artifact.
- The pair iterate until it is polished.

### 2. Existing artifact -> refinement

- A human brings an existing Markdown file or artifact.
- The agent opens it in Workshop.
- The human comments on specific sections or regions.
- The agent applies changes to the real file.
- The revision flow stays attached to the artifact rather than scattered through chat.

## Planned Repo Shape

```text
workshop/
  AGENTS.md
  README.md
  docs/
    project-brief.md
  src/
  examples/
```

## Status

Workshop is currently a product idea being shaped from real collaboration pain rather than from theory.

The immediate goal is to define a credible v0 that solves Markdown-first artifact refinement well before expanding further.
