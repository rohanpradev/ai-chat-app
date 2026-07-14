# Model Policy

## Source of Truth

The approved chat model catalog lives in `shared/models.ts`. The server may check the OpenAI model list at runtime, but it only exposes approved IDs from that shared catalog.

## Default Model

The only approved chat model is `gpt-5-mini`. The only approved embedding model is `text-embedding-3-small`.

As of July 9, 2026, OpenAI's current public docs describe GPT-5.5 as the latest GPT-5 family model and recommend treating it as a tuned migration rather than a drop-in string replacement. This repo should evaluate GPT-5.5 through `OPENAI_MODEL_OVERRIDES` before changing `defaultModelId`.

The default chat model should be capable of:

- Tool calling
- Streaming
- Reasoning over multi-step agent workflows
- Structured output support for future extraction and eval flows

When changing `defaultModelId`, run the eval checklist in `docs/evals.md` and verify the UI can still stream text, tool calls, tool results, sources, and metadata.

## Upgrade Rules

- Prefer explicit model IDs over ambiguous aliases for reproducible releases.
- Add candidate model IDs with `OPENAI_MODEL_OVERRIDES` for testing before putting them in `shared/models.ts`.
- Keep older fallback models available until the replacement passes chat, tool, RAG, and latency checks.
- Do not upgrade model strings and SDK major versions in the same PR unless the SDK migration requires it.
- Record major model changes in release notes with expected behavior, cost, latency, and tool-calling differences.
- Benchmark candidate models against representative tasks for quality, token use, end-to-end latency, tool-call precision, and refusal behavior.

## AI SDK Channel

This repo currently tracks beta AI SDK packages. That can be useful for a flagship AI project, but it means SDK upgrades should be treated as migration work, not routine patch updates. For production stability, pin exact beta versions and keep the lockfile committed.

Relevant primary docs:

- OpenAI latest model guide: `https://developers.openai.com/api/docs/guides/latest-model`
- OpenAI prompt guidance: `https://developers.openai.com/api/docs/guides/prompt-guidance`
- AI SDK tool calling: `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`
