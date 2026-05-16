# AI Architecture

## Request Flow

1. The React client sends validated UI messages to the Hono API.
2. The server validates the request with shared Zod schemas.
3. The selected agent mode resolves to an AI SDK agent.
4. The agent streams UI-message parts back through SSE.
5. Completed conversations are persisted for the authenticated user.

## Structured AI Endpoints

The API also exposes non-streaming structured generation endpoints backed by AI SDK `generateText` with `Output.object()`:

- `POST /{BASE_API_SLUG}/ai/plan` - converts a prompt and optional context into a typed execution plan, recommended agent mode, recommended tools, risks, and evaluation checklist.
- `POST /{BASE_API_SLUG}/ai/evaluate` - runs a typed LLM-as-judge evaluation over an input/output pair with optional reference, context, and rubric.

Both endpoints use shared schemas from `shared/schemas/ai.schema.ts`, return token usage metadata, and are rate-limited behind authenticated sessions.

## Agents and Tools

Agent profiles live in `server/src/lib/agents.ts`. Tool definitions live in `server/src/lib/tools.ts`.

Current server-side tool:

- `serper` - live web search for current information

The search tool is approval gated with `needsApproval: true`, strict Zod input/output schemas, timeouts, output normalization, and model-facing summaries rather than raw full-page content.

## Current AI Docs Direction

The major provider docs are converging on the same patterns:

- Structured outputs for final machine-readable responses
- Function or tool calling for actions and intermediate work
- MCP as a standard integration layer for external tools
- Streaming-first user experiences
- Prompt caching and context management for cost and latency
- Evals, traces, and feedback loops before model upgrades
- Human approval for sensitive tools

The codebase already uses AI SDK agents, streaming, shared schemas, structured output, tool approval, RAG, and Langfuse/OpenTelemetry. The next substantial product upgrades should be MCP tool registration, first-class eval fixtures, and richer generative UI cards for approved tool results.

## Observability

Langfuse telemetry is enabled only when credentials are configured. Sentry is optional for runtime errors. Keep traces free of secrets and user-private document content unless a deployment has explicit approval and retention controls.

## Safety Boundaries

- Server-side tools must be allowlisted in `shared/tool-ids.ts`.
- Tool input/output must be schema validated.
- Tools that reach the network, mutate data, execute code, or spend money must require approval.
- Model output must not be trusted as authorization. Use authenticated user IDs from server-side session state.
