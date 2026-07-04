# Draft Evolution North Star

This note captures the future product direction beyond the current narrow proposal implementation.

It is intentionally short.
Its job is to preserve the right conceptual model while the current slice stays tight.

## Core Framing

Workshop is ultimately not a `section review` product.

It is a document workshopping product where the durable abstraction is:

- one canonical document
- one active pending proposal set for that document at a time
- conversation that helps shape the next proposal
- accepted proposals that become revisions

Section focus still matters, but as a conversational and UI aid rather than the hard boundary of what a proposal is allowed to touch.

## Two Important Starting States

Workshop should support two equally valid entry points:

1. `0 -> 1 draft creation`
   - the document may begin blank or near-blank
   - the human discusses intent, shape, tone, and goals with the agent
   - the first meaningful proposal may be a whole-document first draft

2. `existing document refinement`
   - the document may already exist with meaningful structure and content
   - the human and agent refine, restructure, expand, condense, or redirect that draft
   - the next proposal may affect one section, several sections, or the whole document

The product model should handle both without switching mental models.

## Long-Term Proposal Shape

The current single-section replacement path is only one early proposal kind.

Future proposal sets should be able to represent things like:

- rewrite one section
- rewrite several sections together
- insert a new section
- remove a section
- split one section into two or more sections
- merge adjacent sections
- reorder sections
- replace the whole document
- create the first full draft for an empty document

The key product principle is that proposal scope is governed by intent, not by the currently selected section.

## Role Of Section Selection

Section selection should eventually mean:

- this is the area the human is looking at
- this is likely where the next discussion should anchor
- this is useful context for rendering, navigation, and inline review

It should not permanently mean:

- the proposal may only touch this section
- the agent is forbidden from proposing broader structural changes

In constrained v1 implementations, stricter section-lock behavior may still be useful to reduce ambiguity.
That should be treated as a temporary affordance around a narrow proposal model, not the product's enduring rule.

## Example Flows

### Blank Document To First Draft

1. Human creates a new blank document and names it.
2. Human discusses audience, purpose, tone, and rough shape with the agent.
3. Agent proposes a `0 -> 1` first draft.
4. Human reviews in document context.
5. Later proposals refine, split, add, or reorder sections as the draft sharpens.

### Existing Document To Richer Structure

1. Human opens an existing document with several sections.
2. Human focuses one section and says it should become two sections, while also adding a new supporting section elsewhere.
3. Agent discusses or proposes a structural revision set.
4. Human reviews those proposed changes in document context as one pending proposal set.

## Implications For Future Design

When Workshop grows past the current slice, the proposal model should move toward:

- richer proposal item kinds
- multi-item proposal sets
- document-level review semantics that still preserve inline anchors where possible
- UI language centered on `pending proposal set for this document`, not `pending section change`

That is the north star.
The current v1 implementation should be allowed to stay narrower as long as it does not misstate the underlying direction.
