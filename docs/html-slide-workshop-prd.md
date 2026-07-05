# Workshop HTML Slide Deck Support PRD

## Purpose

Define how Workshop could extend beyond Markdown documents to support workshopping HTML slide decks as a first-class artifact type.

## One-Line Product Goal

Let a user iterate on HTML slide decks in Workshop using the same document-centered human-agent loop that already works for Markdown files.

## Why This Matters

Some of the highest-value work is not prose documents.

It is:

- presentations
- lightweight narrative slide decks
- structured HTML-based talks or demos

For those artifacts, Workshop could become unusually valuable because:

- the content is still structured
- the narrative still benefits from critique and revision
- the visual/resulting artifact matters more than raw text alone

HTML slide decks are a natural next candidate because they are file-backed, structured, and locally runnable.

## Product Position

This is an expansion PRD, not the next immediate build target.

The point is not to turn Workshop into a generic design tool.

The point is to preserve the Workshop thesis across another artifact type:

- the artifact stays primary
- the agent helps shape it
- the human reviews changes in context

## v1 Goal

Prove one believable loop:

1. user opens an HTML slide deck in Workshop
2. Workshop presents both structure and render-aware context
3. user discusses improvements with the agent
4. the agent proposes concrete changes to slide content or structure
5. user reviews and applies those changes safely

If that works, Workshop has shown that its core model generalizes beyond Markdown.

## v1 Non-Goals

This PRD does not attempt to solve:

- full visual drag-and-drop slide editing
- arbitrary Figma replacement
- pixel-perfect WYSIWYG design tooling
- every presentation framework at once
- advanced animation authoring
- layout editor controls for every CSS property

This is about document-like iteration on structured slide artifacts.

## User Story

Scott has an HTML slide deck and wants help tightening narrative flow, rewriting slide copy, adjusting structure, and possibly adding or removing slides.

He wants to do that with the artifact itself in view, not by pasting chunks into chat.

Workshop should let him review and evolve the deck with the same confidence he gets from the Markdown document workflow.

## Core Product Requirements

### 1. HTML Slide Deck Artifact Support

Workshop must be able to open a supported HTML slide deck as a first-class artifact.

Requirements:

- the file-backed artifact can be loaded and saved
- the system can understand enough structure to anchor discussion and proposals
- the product should not treat the deck as an opaque blob

### 2. Render-Aware Review

Workshop must provide more than source-only editing.

Requirements:

- the user should be able to understand the slide as rendered output
- the product should preserve a strong connection between source structure and visual result
- proposed changes should be reviewable in a way that respects slide context

### 3. Slide-Level and Deck-Level Change Support

The proposal model must support changes such as:

- rewrite slide copy
- add a slide
- remove a slide
- reorder slides
- revise speaker narrative structure

### 4. Keep the Artifact Primary

The conversation rail should still guide, summarize, and navigate.

The main review surface should remain the deck itself or a deck-native representation.

## Product Flows

### Flow 1: Tighten Slide Copy

1. user opens a slide deck
2. user focuses a slide
3. user asks the agent to sharpen wording
4. Workshop presents a concrete proposal
5. user reviews and accepts or rejects

Success criteria:

- the loop feels familiar relative to Markdown Workshop

### Flow 2: Add or Remove Slides

1. user asks to insert or remove a slide
2. Workshop proposes the structural change
3. user reviews the impact in deck context
4. user accepts or rejects

Success criteria:

- structural deck changes feel reviewable and safe

## UX Requirements

The deck experience should feel artifact-native.

Required visible elements:

- slide-aware navigation
- render-aware review context
- clear proposal anchoring to slide structure

Nice to avoid in v1:

- pretending source diff alone is enough
- turning the product into a visual design suite
- collapsing the deck into a generic text document

The experience should feel like:

- workshopping a presentation artifact

not:

- editing random HTML in a code editor

## Technical Requirements

### 1. Structured Parsing or Adapter Layer

Workshop will likely need an artifact adapter that can expose slide structure in a way similar to Markdown sections.

### 2. Preview Integration

The shell should support render-aware previewing of the deck while preserving safe local file-backed edits.

### 3. Proposal Model Generalization

The current proposal model may need to evolve from section-oriented Markdown assumptions toward more generalized artifact anchors.

## Open Questions

- Which HTML slide framework should be the first supported target?
- What is the right balance between source view and rendered slide view?
- How much visual diffing is needed before review feels trustworthy?
- Should this wait until checkpointing/branching exists, since deck exploration may fork quickly?

## Product Test

This PRD is satisfied when all of the following are true:

- Workshop can open a supported HTML slide deck artifact
- the user can discuss and review changes in artifact context
- structural deck changes are safely representable
- the core Workshop document-first thesis still holds for this new artifact type
