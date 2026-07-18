# AI, Streaming, Tools, and Evals

Read `docs/ai-architecture.md`, `docs/evals.md`, and `docs/model-policy.md` before changing AI behavior. Verify volatile package and model details against current manifests and primary vendor documentation.

## End-to-End Chat Seam

Preserve this flow unless the task deliberately changes its contract:

1. `client/src/hooks/useAgentChat.ts` shapes typed UI messages for transport.
2. Shared Zod schemas validate the request.
3. `server/src/routes/ai/` resolves the requested, allowlisted agent and model.
4. `server/src/lib/agents.ts` executes the AI SDK `ToolLoopAgent` with server tools.
5. `createAgentUIStreamResponse` streams typed UI-message parts and metadata.
6. Conversation persistence records the current projection and immutable message revisions.
7. The client validates metadata and renders each part, including tool approval states.

When any step changes, test the adjacent step on both sides of the boundary.

## Streaming Invariants

- Return AI SDK stream responses directly; preserve SSE content type, flushing, abort propagation, timeouts, and stream consumption.
- Pass current `uiMessages`, `abortSignal`, timeout, `consumeSseStream`, and stream options explicitly where the installed API requires them.
- Preserve text, reasoning, source, file, metadata, tool-call, approval, result, denial, error, and interrupted states supported by the current UI-message schema.
- Normalize or remove incomplete tool parts before resubmitting persisted conversations. Feed model conversion only complete states.
- Verify success, user abort, provider error, timeout, denied approval, resume, regeneration, and saved-conversation resubmission.
- Keep proxy buffering and compression behavior compatible with `text/event-stream`.

## Models and Providers

- Treat `shared/models.ts` as the allowlist and default-model source of truth.
- Test candidate model IDs through `OPENAI_MODEL_OVERRIDES` before promoting them into the shared catalog.
- Keep provider code and credentials on the server.
- Keep AI SDK packages on compatible release lines. Treat a major upgrade as migration work and inspect primary docs plus installed types.
- Avoid changing the model, SDK major, prompt, tool schema, and stream format in one unmeasured step.
- Record the resolved model in message metadata; distinguish a requested model only when fallback behavior makes that useful.

## Tools and Approval

- Register public tool identity in `shared/tool-ids.ts` and `shared/tools.ts`; implement execution in `server/src/lib/tools.ts`.
- Apply strict input and output schemas, timeouts, bounded output, and safe model-facing summaries.
- Require approval for network access, mutation, code execution, private-data access, or spend. Preserve signed approval behavior where configured.
- Let the server choose available tools. Reject arbitrary client-supplied tool names or provider options.
- Test approved, denied, expired or tampered, unavailable, timed-out, and failed calls. Prevent retry loops after denial.
- Expose links and useful structured results without leaking raw provider payloads.

## RAG, Usage, and Privacy

- Keep retrieval scoped to the authenticated user's documents.
- Preserve database-side vector similarity filtering, ordering, and limiting.
- Test empty, oversized, unsupported, and textless uploads plus missing-context answers.
- Preserve quota reservation before provider calls, settlement from provider usage, stale-reservation expiry, UTC reset semantics, and cross-replica advisory locking.
- Keep private document content, prompts, tool payloads, and credentials out of logs and traces unless explicit retention controls authorize them.

## Evaluation Flywheel

Use a baseline-to-candidate flywheel for prompts, models, tools, RAG, normalization, and AI SDK changes:

1. **Prepare:** Capture representative inputs, expected properties, tool decisions, references, and failure cases. Include multi-turn and interrupted traces where relevant.
2. **Run:** Replay the same fixture set with deterministic settings where practical. Persist raw results and safe traces.
3. **Grade:** Use deterministic assertions first. Add rubric or LLM-as-judge scores for qualities that code cannot measure. Treat judge output as evidence, never authorization.
4. **Analyze:** Group failures by behavior: task completion, trajectory, tool choice, grounding, safety, format, latency, or cost. Read individual failures before changing prompts.
5. **Change one variable:** Target the dominant failure cluster.
6. **Compare:** Confirm the target improved and protected metrics did not regress.
7. **Expand:** Add the fixed failure to the permanent fixture set, then broaden coverage.

For model upgrades, compare at least quality, tool-call precision, grounding, refusal behavior, first-token latency, end-to-end latency, and token usage. Do not promote the default until chat streaming, approval, RAG, structured endpoints, persistence, and representative evals pass.

## AI Completion Evidence

Produce evidence appropriate to the change:

- a fixture or trace that failed before and passes after;
- stream-part assertions for protocol changes;
- approval-state assertions for tool changes;
- before/after eval results for behavior changes;
- saved-conversation replay for normalization changes;
- metadata assertions for model or usage changes;
- browser evidence for user-visible streaming states.

