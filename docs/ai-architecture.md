# AI Architecture

## Request Flow

1. The React client sends validated UI messages to the Hono API.
2. The server validates the request with shared Zod schemas.
3. The selected agent mode resolves to an AI SDK agent.
4. Accepted messages are saved before model preparation. A storage failure releases the quota reservation and prevents a provider call; a preparation failure leaves the prompt available after a refresh.
5. The agent streams UI-message parts back through SSE.
6. Completed conversations update a current-message projection and append immutable message revisions.

Conversation writes take a PostgreSQL advisory transaction lock per chat, which prevents two server replicas from interleaving revisions. Regeneration and resumed streams update the current projection without erasing prior message bodies. Deleting a conversation remains a deliberate cascade over both current messages and their revision history.

## Retrieval and Usage Control

Document chunks use `vector(1536)` and an HNSW cosine index provided by pgvector. Similarity filtering, ordering, and limiting run in PostgreSQL; vectors are not loaded into application memory for ranking.

AI and embedding calls reserve quota in `usage_event` before contacting a provider, then settle provider-reported token usage. PostgreSQL advisory locks make daily limits consistent across replicas. Reservations older than 15 minutes stop consuming token or upload capacity, protecting users from a crashed worker. `GET /{BASE_API_SLUG}/ai/usage` exposes daily request/token usage, embedding token usage, storage usage, and the UTC reset time.

Default limits can be overridden with `AI_DAILY_REQUEST_LIMIT`, `AI_DAILY_TOKEN_LIMIT`, `EMBEDDING_DAILY_TOKEN_LIMIT`, and `EMBEDDING_STORAGE_BYTE_LIMIT`.

## Structured AI Endpoints

The API also exposes non-streaming structured generation endpoints backed by AI SDK `generateText` with `Output.object()`:

- `POST /{BASE_API_SLUG}/ai/plan` - converts a prompt and optional context into a typed execution plan, recommended agent mode, recommended tools, risks, and evaluation checklist.
- `POST /{BASE_API_SLUG}/ai/evaluate` - runs a typed LLM-as-judge evaluation over an input/output pair with optional reference, context, and rubric.

Both endpoints use shared schemas from `shared/schemas/ai.schema.ts`, return token usage metadata, and are rate-limited behind authenticated sessions.

## Agents and Tools

Agent profiles live in `server/src/lib/agents.ts`. Tool definitions live in `server/src/lib/tools.ts`.

Current server-side tool:

- `serper` - live web search for current information

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

The codebase already uses AI SDK agents, streaming, shared schemas, structured output, tool approval, database-native RAG, durable usage metering, and Langfuse/OpenTelemetry. The next substantial product upgrades should be MCP tool registration, first-class eval fixtures, and richer generative UI cards for approved tool results.

Model IDs are deliberately allowlisted. The shared fallback catalog lives in `shared/models.ts`, and deployments can add comma-separated account-specific IDs with `OPENAI_MODEL_OVERRIDES`. Streamed message metadata records the resolved model ID, with `requestedModel` included only when the request fell back to a different approved model.

## Observability

AI SDK telemetry is enabled when either Langfuse or Sentry is configured. Every chat, structured-generation, RAG, and embedding call has a stable `functionId`, while prompt inputs and model outputs are explicitly excluded from telemetry. Langfuse receives AI SDK spans through OpenTelemetry; Sentry's Vercel AI integration records the same operations and streamed generative-AI spans when `SENTRY_DSN` is present.

Stream errors are explicitly captured because handled AI SDK errors are not reported by Sentry automatically. Provider failures are also marked as failed usage even when the UI stream emits a friendly error part and completes its transport lifecycle. Keep traces free of secrets and user-private document content unless a deployment has explicit approval and retention controls.

## Safety Boundaries

- Server-side tools must be allowlisted in `shared/tool-ids.ts`.
- Tool input/output must be schema validated.
- Tools that reach the network, mutate data, execute code, or spend money must require approval.
- Model output must not be trusted as authorization. Use authenticated user IDs from server-side session state.
- Newly released model IDs should enter through `OPENAI_MODEL_OVERRIDES` first, then graduate into `shared/models.ts` only after evals and streaming/tool approval checks pass.
