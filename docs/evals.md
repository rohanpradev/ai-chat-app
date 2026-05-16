# AI Evaluation Checklist

Run this checklist before changing prompts, tools, model defaults, AI SDK major versions, RAG behavior, or streaming transport.

## Core Chat

- Basic assistant response streams without buffering.
- Regenerate works for persisted conversations.
- Long conversation history normalizes without orphaned tool-call parts.
- User-facing error message is generic when provider calls fail.

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
- Sentry PII settings are intentional.
- Telemetry sampling is appropriate for the environment.

## Release Checks

```bash
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
