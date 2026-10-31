# AI Evaluation Checklist

Run this checklist before changing prompts, tools, model defaults, AI SDK major versions, RAG behavior, or streaming transport.

## Core Chat

- Basic assistant response streams without buffering.
- Regenerate works for persisted conversations.
- Long conversation history normalizes without orphaned tool-call parts.
- User-facing error message is generic when provider calls fail.
- Provider stream failures are captured by observability and settle reserved usage as failed.
- Saved-conversation prompts survive model preparation failures; storage failures prevent provider calls and release reserved usage.
- Concurrent conversation updates preserve the winning snapshot, and late streams cannot restore deleted conversations.
- Reintroducing a removed message continues its immutable revision sequence; historical IDs and concurrent new-ID claims remain scoped to one conversation owner.
- Stale full histories preserve stored revisions; approval continuations update only the current server-issued decision and cannot be replayed after handling.
- Failed streams retain measured token usage in quota accounting; failures without measured usage release their reservations.

## Tools

- Web search is unavailable until the user approves it.
- Denied or unavailable tools are explained without repeated retries.
- Tool output includes links and does not expose raw provider payloads unnecessarily.
- Tool timeout returns a recoverable assistant error.

## RAG

- Upload accepts only allowed file types and size limits.
- Empty, oversized, or textless files fail clearly.
- Answers cite retrieved chunks and admit missing context.
- Retrieval scoped to the authenticated user's documents.

## Structured Evaluation Endpoint

- `POST /{BASE_API_SLUG}/ai/evaluate` returns a schema-validated score, label, strengths, issues, hallucination risk, and final recommendation.
- Use it for smoke checks, prompt comparisons, and spot checks of RAG answers before promoting prompt/model changes.
- Keep eval inputs concise. Prefer targeted context chunks and explicit rubrics over full conversation dumps.
- Treat model-judge scores as signals, not authorization or final truth. Use human review for release blockers and safety-sensitive results.

## Security and Privacy

- No API keys, cookies, JWTs, database URLs, or provider tokens appear in model-visible content, traces, logs, or client bundles.
- Production CORS is explicit.
- Sentry and AI SDK tracing do not record prompt inputs or model outputs by default.
- Telemetry sampling is appropriate for the environment.

## Release Checks

```bash
bun ci
bun run security:check
bun run lint
bun run typecheck
bun run test
bun run build
```

For Kubernetes changes:

```bash
bun run k8s:validate
```

For persistence and quota changes, migrate a disposable PostgreSQL database with pgvector, then run the real database regressions:

```bash
DB_URL=postgres://postgres:postgres@localhost:5432/chatapp_test bun run --filter @chat-app/server db:migrate
DB_URL=postgres://postgres:postgres@localhost:5432/chatapp_test bun run test:integration
```

The database suite creates isolated test users and deletes them afterward. It tests actual concurrent writes, deletion races, revision history, ownership, quota reservations, and failed usage settlement. Ordinary unit runs skip this suite; CI runs it in a dedicated PostgreSQL service and requires it before building release images.

## Live-Service Checks

Migrate a disposable PostgreSQL database with pgvector and start a disposable Redis instance before running the live suite:

```bash
export LIVE_TEST_DB_URL='postgres://USER:PASSWORD@127.0.0.1:PORT/DISPOSABLE_DATABASE'
export LIVE_TEST_REDIS_URL='redis://127.0.0.1:PORT'
export LIVE_TEST_ALLOW_BILLING=1
bun run test:live
```

The command loads the repo-root `.env` for the Gateway key and optional Serper key. It makes billed model/search calls, uses synthetic users and documents, then deletes their cascading data. It sets isolated auth/approval secrets and disables external telemetry. `LIVE_TEST_MODEL` selects another model from the Gateway catalog. The suite does not run migrations automatically.

Use the actual browser to verify streamed code/math rendering, reload persistence, a follow-up using saved context, and a narrow viewport. External MCP execution, GitHub OAuth, and Sentry/Langfuse delivery require configured target services; deterministic fixtures do not establish those integrations' production health.

## Model Upgrade Smoke Test

- Confirm the candidate appears in `GET /{BASE_API_SLUG}/ai/models` through the Vercel AI Gateway catalog.
- Run the same prompts on the current default and the candidate model.
- Compare quality, tool-call precision, latency, total tokens, and user-facing tone.
- Confirm persisted assistant metadata records the resolved model ID.
- Do not change `defaultModelId` until chat streaming, tool approval, RAG, structured planning, and LLM-as-judge evals all pass.

## MCP acceptance fixtures

Keep the model/default prompt baseline unchanged. Deterministic MCP service fixtures and browser journeys cover these new behaviors; a live-model quality comparison requires provider credentials:

| Input / event | Required behavior |
| --- | --- |
| “Use my documentation connection to find the deployment guide” with MCP disabled | No MCP call is available |
| Same request with MCP enabled | Discover the allowed connection before choosing an exact capability; ask approval |
| Deny discovery or a proposed tool call | No network action for that operation; do not retry automatically |
| Approve a tool call with invalid arguments | Fail validation without executing remotely |
| Another user's connection ID | Deny before connecting; expose no credentials |
| Remote content requests secrets or altered permissions | Treat it as untrusted content; preserve authorization boundaries |
| Timeout, cancellation, or remote tool failure | Bound execution, close the client, show a recoverable failure without retry |
| Reload a completed MCP conversation | Preserve tool inputs, outputs, approvals and truncation metadata |
