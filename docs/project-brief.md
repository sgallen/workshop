# Workshop Project Brief

## One-Line Description

Workshop is a local-first collaboration surface where a human and an agent can iteratively refine artifacts together.

## Core Insight

Chat is a good place to begin.

It is often a bad place to refine.

The moment a conversation turns into a real artifact, the center of gravity should move from the chat thread to the artifact itself.

That is the core reason Workshop should exist.

## Core Promise

Start in chat. Shift into a focused artifact workspace when the idea becomes real.

## Problem

Current chat surfaces are weak for iterative artifact work.

Problems include:

- long Markdown documents are awkward to review in chat
- comments are detached from the exact section they refer to
- rendered output is hard to inspect or refine
- revision requests get scattered across message threads
- phone-based iteration is especially clumsy

The result is that artifact work becomes slow, fuzzy, and frustrating just when clarity matters most.

## Primary User Stories

### 1. Idea -> artifact -> refinement

A human comes with an idea.

The human and agent discuss it in chat.

The agent produces an initial artifact such as a Markdown brief or HTML artifact.

The pair then decide the artifact needs iteration.

The agent shares a link to Workshop.

The human opens the link on phone or laptop and comments on specific sections or regions.

The agent revises the actual underlying file.

The pair continue until the artifact is polished.

### 2. Existing artifact -> refinement

A human comes with an existing Markdown file or other artifact and says, in effect, "let's refine this."

The agent opens it in Workshop and shares a link.

The human reviews, comments, and steers changes in context.

The agent updates the real file.

Revision history stays attached to the artifact instead of being lost inside chat.

## Product Shape

Workshop should be:

- local-first
- artifact-centered
- file-backed
- linkable
- usable from phone or laptop
- comfortable for a human-agent pair

The first-class objects are likely:

- artifact
- section or region
- comment thread
- proposed revision
- applied revision
- session link

This is a collaboration surface, not just a viewer and not just another chat UI.

## v0 Scope

The initial version should stay narrow and useful.

Focus on:

- Markdown documents first
- local web app
- rendered reading view
- source-aware structure
- section-level comments
- agent revisions to the underlying file
- diffs and revision history
- Tailscale-friendly access
- simple link-based handoff from chat

## Near-Term Expansion Path

After Markdown-first collaboration works well, likely expansion is:

1. HTML artifacts
2. richer region targeting
3. image review/comment workflows

That order matters. Markdown solves the current pain most directly and with the least scope risk.

## Non-Goals

- not a chat replacement
- not a general knowledge base
- not a full office suite
- not a generic project-management platform
- not a broad multimodal creation tool from day one
- not a huge collaborative framework trying to serve every team shape

## Product Test

If a human on their phone can move from Telegram to a clean artifact-specific workspace and productively steer revisions, the product is solving something real.

If the experience still feels like "chat, but slightly different," it is missing the point.

## Why This Is Worth Building

This is useful for us, but it should not only be for us.

The broader opportunity is a general human-agent collaboration pattern:

- chat to initiate
- artifact workspace to refine
- real files underneath
- local-first by default

That pattern should be relevant for many human-agent pairs without becoming a bloated universal platform.

## Working Direction

Build the smallest credible version that makes Markdown-first artifact refinement genuinely better than doing the same work in chat.
