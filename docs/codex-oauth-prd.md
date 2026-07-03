# Workshop Codex OAuth PRD

## Purpose

Define the smallest credible product slice that lets Workshop run document workshopping turns through a user's own ChatGPT/Codex-authenticated account instead of a shared API key.

This PRD is for a narrow v1 implementation target that a coding agent can execute.

## One-Line Product Goal

Let a user connect their own ChatGPT/Codex account to Workshop and use that auth to run document-focused agent turns inside Workshop.

## Why This Matters

Workshop is supposed to feel like a real human-agent document product, not a static mock and not a thin wrapper around a developer's personal API key.

The desired user experience is:

- the user opens Workshop
- the user connects their own account once
- the user asks the agent to critique or rewrite a document section
- Workshop runs that turn against the user's own Codex-authenticated account
- the result comes back into the document workflow

For local/private use, this also aligns cost and account ownership correctly:

- the developer is not subsidizing every user with a shared API key
- the user is explicitly choosing to use their own account
- the auth model matches the product expectation that the agent belongs to the user

## Product Position

Workshop should take inspiration from how OpenClaw binds OpenAI Codex OAuth to a local runtime.

Workshop should not depend on OpenClaw as the runtime substrate.

The correct relationship is:

- OpenClaw is proof that this auth shape is workable
- Workshop owns its own auth, runtime binding, and document loop
- the Workshop user experience must stand on its own

## v1 Goal

Prove one real end-to-end loop:

1. a user connects Codex/ChatGPT auth
2. Workshop stores that auth locally and safely
3. Workshop shows that the agent is available
4. the user asks for one document-native action
5. Workshop runs the action through the authenticated Codex provider
6. Workshop returns the result into the current document session

If this works reliably, Workshop has crossed from prototype UI into a real product loop.

## v1 Non-Goals

This PRD explicitly does not aim to solve:

- generalized multi-provider auth
- shared team/org auth management
- OAuth support for providers other than OpenAI Codex
- marketplace-style provider selection
- polished billing or usage dashboards
- cloud sync or hosted multi-tenant architecture
- arbitrary free-form tool ecosystems
- broad role/account administration
- guaranteed public-product compatibility with all future OpenAI platform rules

This is a local/private alpha slice.

## User Story

Scott opens Workshop and wants to workshop a real Markdown document with an agent.

He does not want Workshop to rely on Barney's API key.

He clicks `Connect ChatGPT/Codex`, completes the auth flow once, returns to Workshop, and sees that the agent is connected.

He selects a section, asks for a rewrite or critique, and Workshop runs the request using his own Codex-authenticated account.

The resulting critique, rewrite, or proposed change appears back in the document workflow.

## Core Product Requirements

### 1. User-Owned Auth

Workshop must let the current user connect their own Codex/ChatGPT auth.

Requirements:

- the auth flow is initiated explicitly by the user
- Workshop stores auth per local user/profile, not as a hard-coded shared credential
- Workshop can tell whether auth is present, missing, expired, or invalid
- Workshop can disconnect or clear stored auth

### 2. Explicit Provider Binding

Workshop must bind document-agent turns to a concrete runtime provider.

For v1, that provider is:

- `openai-codex`

Requirements:

- Workshop knows when the current session is using Codex auth
- the provider binding is visible in state, not implicit magic
- failures in auth or refresh surface cleanly to the UI

### 3. Real Agent Availability State

Workshop must expose a small, understandable availability state.

At minimum:

- `not_connected`
- `connecting`
- `connected`
- `expired`
- `error`

The product should make it obvious whether the agent is currently usable.

### 4. Document-Native Action Execution

Workshop must use the authenticated provider for actual document work, not just a connection test.

v1 only needs one narrow action path to be real.

Good candidates:

- `critique_document`
- `rewrite_section`

The recommendation is to implement `rewrite_section` first if that is easier to evaluate visibly, or `critique_document` first if that is simpler to wire safely.

### 5. Safe Local Credential Handling

Credentials must be stored locally and treated like secrets.

Requirements:

- no secrets in the client bundle
- no secrets in URLs
- no secrets in repo files
- no accidental logging of raw tokens
- a clear storage boundary on the server side

## Product Flows

### Flow 1: Connect Account

1. user opens Workshop
2. Workshop shows an agent/auth state with `Connect ChatGPT/Codex`
3. user starts the connect flow
4. Workshop launches the Codex/ChatGPT OAuth login flow
5. user completes auth
6. Workshop stores resulting credentials locally
7. Workshop returns to a `connected` state

Success criteria:

- the user can complete the flow without terminal usage
- the result is durable across page reloads and app restarts

### Flow 2: Resume With Existing Auth

1. user opens Workshop later
2. Workshop checks stored auth state
3. if valid or refreshable, Workshop shows `connected`
4. if refresh fails, Workshop shows `expired` or `error` and asks for reconnect

Success criteria:

- normal usage should not require repeated login
- failures should degrade clearly rather than silently

### Flow 3: Run One Agent Turn

1. user opens a document
2. user selects document scope or section scope
3. user chooses a supported action
4. Workshop sends the request to the server runtime
5. server uses the authenticated Codex provider binding
6. result comes back into Workshop
7. the UI renders the result in a document-first way

Success criteria:

- the turn is run using the connected account
- the result is visible in context
- failure states are understandable

### Flow 4: Disconnect Account

1. user opens auth/provider controls
2. user disconnects
3. Workshop deletes local credentials
4. Workshop returns to `not_connected`

Success criteria:

- disconnect is explicit
- a disconnected session cannot continue using stale auth

## UX Requirements

The UI for v1 should stay minimal.

Required visible elements:

- current agent/provider status
- connect button when disconnected
- reconnect prompt when expired
- disconnect option when connected
- clear indication that the connected account powers document actions

Nice to avoid in v1:

- giant settings surfaces
- provider pickers
- billing-style analytics
- verbose auth debugging UI

The UI should feel like:

- one agent
- one connected account
- one clear document workflow

not:

- an LLM admin console

## Technical Requirements

These are requirements for implementation, not detailed design.

### 1. Server-Side Auth Ownership

The server must own OAuth login initiation, callback handling, token refresh, credential storage, and provider-bound request execution.

The client should only:

- query auth status
- initiate connect/disconnect
- initiate supported agent actions
- render status and results

### 2. Reuse A Known Codex OAuth Pattern

Implementation should borrow the proven local pattern already used in this environment:

- OpenAI Codex OAuth login
- refreshable stored credentials
- provider binding to `openai-codex`

The implementation may reuse code or ideas from local libraries if appropriate, but Workshop must keep its own product seam.

### 3. Minimal HTTP/API Surface

v1 should keep the API surface small.

Recommended endpoints or equivalent server actions:

- `GET /api/agent/auth-status`
- `POST /api/agent/connect`
- `POST /api/agent/disconnect`
- `POST /api/agent/actions/rewrite-section`

If `critique_document` is chosen instead of `rewrite_section`, substitute accordingly.

### 4. Storage Boundary

Workshop needs a local credentials store.

Requirements:

- separate from the document data model
- not committed to git
- readable by the local Workshop server only
- designed so future per-user separation is possible

### 5. Action Execution Boundary

The implementation should keep these concerns separate:

- auth state
- provider/runtime client
- document/section action construction
- result handling and rendering

This matters because Workshop will likely gain more providers and more actions later.

## Suggested v1 Scope Decision

To reduce implementation risk, v1 should support:

- one provider: `openai-codex`
- one auth mode: user-initiated Codex/ChatGPT OAuth
- one primary action: `rewrite_section` or `critique_document`
- one local credentials store
- one status surface in the existing app

Do not build:

- generic provider registries
- advanced settings frameworks
- abstract auth plugin systems
- multi-account switching

## Current Codebase Implications

At the moment, Workshop is a very small app with:

- one React client entry
- one main application component
- local document-reading and comment/demo workflow

That means the implementation should probably introduce a clean seam instead of piling auth logic into ad hoc UI state.

The coding agent should expect to add:

- a small server-side auth/runtime module area
- a small client-side auth status model
- one narrow action execution path

The coding agent should avoid turning `App.tsx` into the long-term home for all auth/runtime behavior.

## Open Questions

These questions do not block the PRD, but the implementer should make explicit choices:

1. Should the first real action be `rewrite_section` or `critique_document`?
2. Should auth storage use a plain local file, OS credential store, or a hybrid?
3. What exact result shape should v1 return:
   - critique text
   - proposed replacement text
   - diff
   - full applied file change
4. Should v1 apply changes automatically or only return a proposal?

Recommended defaults:

1. first action: `rewrite_section`
2. storage: simplest safe local mechanism already proven in nearby tooling
3. result shape: proposed replacement plus short rationale
4. application: proposal first, apply second if easy

## Risks

### Platform Risk

It is still possible that the broader third-party product story around Codex/ChatGPT-authenticated usage changes or narrows over time.

That is acceptable for this v1 because the goal is a local/private alpha.

### Complexity Risk

Auth plus runtime plus document actions can sprawl quickly.

The mitigation is to keep the v1 surface extremely narrow.

### Security Risk

Credential mishandling would be an own-goal.

The implementation must default to conservative local secret handling and avoid leaking credentials into logs, URLs, or client-visible payloads.

## Acceptance Criteria

This PRD is satisfied when all of the following are true:

1. A user can connect their own ChatGPT/Codex account from Workshop.
2. Workshop persists and later resumes that auth state locally.
3. Workshop can detect missing, valid, expired, and failed auth states.
4. Workshop can run at least one real document-native agent action using that connected account.
5. The result appears back inside the Workshop document workflow.
6. Workshop can disconnect and clear the stored auth.
7. No shared developer API key is required for the v1 path.

## Implementation Guidance For The Coding Agent

The coding agent should optimize for a narrow, testable slice.

Recommended order:

1. define the server-side auth/provider module seam
2. implement connect, callback, resume, disconnect
3. add auth status API
4. add a single real action endpoint
5. wire minimal client UI for status and connect/disconnect
6. render the first real result inside the document flow

If a choice must be made between polish and reality, choose reality.

The important win is not a pretty auth screen.

The important win is:

- a real user-owned connected account
- one real Codex-backed document turn

