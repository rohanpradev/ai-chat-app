# Model Policy

## Source of Truth

The approved chat model catalog lives in `shared/models.ts`. The server may check the OpenAI model list at runtime, but it only exposes approved IDs from that shared catalog.

## Default Model

The only approved chat model is `gpt-5-mini`. The only approved embedding model is `text-embedding-3-small`.

The default chat model should be capable of:

- Tool calling
- Streaming
- Reasoning over multi-step agent workflows
- Structured output support for future extraction and eval flows

When changing `defaultModelId`, run the eval checklist in `docs/evals.md` and verify the UI can still stream text, tool calls, tool results, sources, and metadata.

## Upgrade Rules

- Prefer explicit model IDs over ambiguous aliases for reproducible releases.
- Keep older fallback models available until the replacement passes chat, tool, RAG, and latency checks.
- Do not upgrade model strings and SDK major versions in the same PR unless the SDK migration requires it.
- Record major model changes in release notes with expected behavior, cost, latency, and tool-calling differences.

## AI SDK Channel

This repo currently tracks beta AI SDK packages. That can be useful for a flagship AI project, but it means SDK upgrades should be treated as migration work, not routine patch updates. For production stability, pin exact beta versions and keep the lockfile committed.
