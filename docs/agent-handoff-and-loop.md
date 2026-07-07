# Workshop Agent Handoff And Loop Note

## Purpose

Capture the concrete split between:

- external handoff into Workshop
- Workshop's own native agent loop

This note exists to keep Workshop product-independent while still making OpenClaw integration simple and useful.

## Core Position

Workshop owns the document workshopping loop.

OpenClaw does not own the loop and should not be required as the runtime beneath Workshop.

OpenClaw can:

- know that Workshop exists
- help install or expose it
- detect when the user wants to shift from chat into document workshopping
- open or resume a document in Workshop
- return the correct link to the user

Once the user enters Workshop, Workshop owns the document-first human-agent interaction.

## Local Runtime Shapes

Workshop should support more than one local runtime shape over time.

The important near-term distinction is:

1. hosted local runtime
   - Workshop is installed on a machine
   - something like OpenClaw may expose or invoke it
   - the user may reach it locally or over Tailscale

2. device-local runtime
   - Workshop is installed directly on the phone
   - the user interacts with it locally on-device
   - no separate Workshop server is required

This note is mostly about the first shape, because that is the current handoff model.

But the product contract should be kept clean enough that the second shape does not require redefining what Workshop is.

## OpenClaw -> Workshop Handoff

The intended user moment is simple:

- the human and OpenClaw are working in chat
- a real document exists or has just been drafted
- the human says something like:
  - "Let's workshop this doc"
  - "Let's use Workshop to refine this"
  - "Open this in Workshop"
- OpenClaw opens or resumes that document in Workshop
- OpenClaw gives the user a stable Workshop URL
- the user jumps into Workshop with that document active

OpenClaw should feel like a caller and handoff point, not like the thing that remains in the middle of every document turn.

## External Handoff Contract

The external contract should stay very small.

### Input

- a real document path or document identifier
- optional title metadata
- optional source metadata describing where the handoff came from
- optional request to resume an existing session if one exists

### Output

- a stable Workshop URL for the active document session
- enough metadata to confirm which document was opened or resumed

### Responsibilities

OpenClaw side:

- know whether Workshop is available
- help set it up if needed
- request open-or-resume for a document
- hand the resulting link to the user

Workshop side:

- resolve the document
- open or resume a document session
- return the correct document-first URL
- expose a lightweight way to copy that stable URL from the document view
- keep local path complexity out of the user-facing flow

Current hosted-local seam:

- `POST /api/artifact/open`
  - input: `path`
  - output: artifact state plus `documentUrl`, `resolvedPath`, `title`, and `resumed`

## Workshop Native Agent Loop

Workshop should own the actual human-agent document loop once the document is active.

The core v1 loop should be:

1. open or create a document
2. choose document scope or section scope
3. direct the agent with a small set of useful actions
4. receive a concrete result against the document
5. review the result in document form
6. iterate

The important constraint is that the document remains primary throughout.

Workshop should not collapse into a generic chat interface with a document beside it.

## First Useful Agent Actions

The v1 action set should stay narrow and opinionated.

Good candidates:

- improve clarity
- rewrite this section
- tighten structure
- critique this draft
- propose a better outline
- expand this area

These actions are valuable because they map directly onto document workshopping rather than generic assistant behavior.

## Native Agent Contract Questions

Workshop needs to define its own agent/runtime seam.

Questions to answer:

- how does Workshop represent an authenticated agent identity?
- how does Workshop know the agent is available?
- how does Workshop issue a request against a document or section?
- what comes back:
  - critique text
  - replacement text
  - diff
  - patch
  - full revised document
- how does Workshop render the result in a document-first way?

## Auth Direction

OpenClaw is a valid source of inspiration for auth and runtime patterns.

Workshop should study how OpenClaw accomplishes OpenAI ChatGPT/Codex OAuth and provider/runtime binding.

But Workshop should still own its own agent/runtime contract.

That means:

- auth inspiration can come from OpenClaw
- product/runtime independence stays with Workshop
- OpenClaw remains an integration, not the substrate

## V1 Recommendation

For v1, there should be two clearly separated seams:

1. External handoff seam
   - how something like OpenClaw opens a document in Workshop

2. Internal agent seam
   - how Workshop itself runs the document workshopping loop

That separation keeps the architecture clean and lets Workshop remain a real standalone product.
