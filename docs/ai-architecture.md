# AI Architecture

## Request Flow

1. The React client sends validated UI messages to the Hono API.
2. The server validates the request with shared Zod schemas.
3. The selected agent mode resolves to an AI SDK agent.
4. Accepted messages are saved before model preparation. A storage failure releases the quota reservation and prevents a provider call; a preparation failure leaves the prompt available after a refresh.
5. The agent streams UI-message parts back through SSE.
6. Completed conversations update a current-message projection and append immutable message revisions.

Conversation writes take a PostgreSQL advisory transaction lock per chat and compare the current message revisions with the request's snapshot inside that lock. Concurrent accepted inputs return `409` before starting a provider call. A stream that finishes after a newer turn or deletion keeps the latest stored projection intact and still settles its provider usage. Deletion uses the same lock and cascades over current messages and revision history, so an earlier stream cannot recreate a deleted chat.

Ordinary submissions preserve stored message content and append new IDs, including when an older client sends a stale full history. Only the current assistant's pending tool approval decision can update an existing message; the server retains its original call, input, signature, metadata, and sibling parts. Repeated or stale approval responses return `409`, while a mismatched input or signature returns `400`. Explicit regeneration may replace the current projection's tail, while immutable revisions retain previous message bodies.

If a removed message ID returns to the same conversation, its revision continues after the highest immutable revision. IDs retained by another conversation cannot be reused, and concurrent claims roll back atomically with a safe `409` response.

The client synchronizes the current transcript to its conversation cache when a stream completes, fails, or is stopped. Conversation navigation waits for the current loader snapshot before initializing chat state, and switching conversation IDs resets the composer, attachments, and tool selections. First prompts pass from the home screen through a user- and conversation-scoped in-memory draft rather than URL search parameters; the draft is removed after handoff or when leaving the conversation.

## Retrieval and Usage Control

Document chunks use `vector(1536)` and an HNSW cosine index provided by pgvector. Similarity filtering, ordering, and limiting run in PostgreSQL; vectors are not loaded into application memory for ranking.

AI and embedding calls reserve quota in `usage_event` before contacting a provider, then settle provider-reported token usage. PostgreSQL advisory locks make daily limits consistent across replicas. Reservations older than 15 minutes stop consuming token or upload capacity, protecting users from a crashed worker. `GET /{BASE_API_SLUG}/ai/usage` exposes daily request/token usage, embedding token usage, storage usage, and the UTC reset time.

Failed operations with measured provider tokens count toward daily token and request quotas. A failure before any measured consumption releases its unused reservation. Repeated error cleanup cannot erase tokens already settled for that request.

Default limits can be overridden with `AI_DAILY_REQUEST_LIMIT`, `AI_DAILY_TOKEN_LIMIT`, `EMBEDDING_DAILY_TOKEN_LIMIT`, and `EMBEDDING_STORAGE_BYTE_LIMIT`.

## Structured AI Endpoints

The API also exposes non-streaming structured generation endpoints backed by AI SDK `generateText` with `Output.object()`:

- `POST /{BASE_API_SLUG}/ai/plan` - converts a prompt and optional context into a typed execution plan, recommended agent mode, recommended tools, risks, and evaluation checklist.
- `POST /{BASE_API_SLUG}/ai/evaluate` - runs a typed LLM-as-judge evaluation over an input/output pair with optional reference, context, and rubric.

Both endpoints use shared schemas from `shared/schemas/ai.schema.ts`, return token usage metadata, and are rate-limited behind authenticated sessions.

## Agents and Tools

Agent profiles live in `server/src/lib/agents.ts`. Tool definitions live in `server/src/lib/tools.ts`.

Current server-side tools:

- `serper` - live web search for current information
- `mcp` - approval-gated, on-demand discovery and use of allowed MCP tools, resources, and prompts; see [MCP workspace](mcp.md)

The search tool is approval gated with AI SDK `toolApproval`, strict Zod input/output schemas, timeouts, output normalization, and model-facing summaries rather than raw full-page content. Set `AI_TOOL_APPROVAL_SECRET` in shared environments so AI SDK can sign approval responses and reject replayed or tampered approvals.

The AI SDK 7 agent boundary follows the current agent guidance: request-specific model and tool settings pass through a runtime-validated `callOptionsSchema` and `prepareCall`; client-authored system messages are rejected in favor of server-owned `instructions`; agent steps and total/chunk/tool time are bounded; request aborts propagate through model and tool calls; and telemetry records operational metadata without prompt or response bodies. Keep those controls explicit when adding an agent or tool.

## Current AI Docs Direction

The major provider docs are converging on the same patterns:

- Structured outputs for final machine-readable responses
- Function or tool calling for actions and intermediate work
- MCP as a standard integration layer for external tools
- Streaming-first user experiences
- Prompt caching and context management for cost and latency
- Evals, traces, and feedback loops before model upgrades
- Human approval for sensitive tools

The codebase already uses AI SDK agents, streaming, shared schemas, structured output, tool approval, database-native RAG, durable usage metering, and Langfuse/OpenTelemetry. The MCP workspace adds capability discovery and previews without loading every remote schema into every model request.

The server uses the Vercel AI Gateway provider for chat and embeddings. The selector fetches available language models from the Gateway `/v1/models` catalog and excludes non-chat modalities; `shared/models.ts` contains the inexpensive fallback. Streamed message metadata records the resolved Gateway model ID, with `requestedModel` included only when the request fell back to the configured default.

## Observability

AI SDK telemetry is enabled when either Langfuse or Sentry is configured. Every chat, structured-generation, RAG, and embedding call has a stable `functionId`, while prompt inputs and model outputs are explicitly excluded from telemetry. Langfuse receives AI SDK spans through OpenTelemetry; Sentry's Vercel AI integration records the same operations and streamed generative-AI spans when `SENTRY_DSN` is present.

Stream errors are explicitly captured because handled AI SDK errors are not reported by Sentry automatically. Provider failures are also marked as failed usage even when the UI stream emits a friendly error part and completes its transport lifecycle. Keep traces free of secrets and user-private document content unless a deployment has explicit approval and retention controls.

## Safety Boundaries

- Server-side tools must be allowlisted in `shared/tool-ids.ts`.
- Tool input/output must be schema validated.
- Tools that reach the network, mutate data, execute code, or spend money must require approval.
- Model output must not be trusted as authorization. Use authenticated user IDs from server-side session state.
- Gateway models appear in the selector when the account reports them as language models. Validate streaming, tool calling, and eval behavior before changing the shared fallback model.
