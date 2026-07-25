# Model Policy

## Source of Truth

The approved chat model catalog lives in `shared/models.ts`. The server may check the OpenAI model list at runtime, but it only exposes approved IDs from that shared catalog.

## Default Model

The only approved chat model is `gpt-5-mini`. The only approved embedding model is `text-embedding-3-small`.

As of July 25, 2026, OpenAI's current public docs describe GPT-5.6 as the latest GPT-5 family. OpenAI's migration guidance maps an existing mini/balanced role to `gpt-5.6-terra`, while `gpt-5.6-sol` is the flagship quality-first option. This repo should evaluate the role-matched `gpt-5.6-terra` candidate through `OPENAI_MODEL_OVERRIDES` before changing `defaultModelId`; `gpt-5.6-sol` should be evaluated separately if the quality gain justifies its cost and latency.

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

This repo tracks the stable AI SDK 7 line. SDK major upgrades remain migration work; patch updates can use the normal dependency process, including the repository's release-age gate and committed lockfile. Before upgrading a major, verify the streaming protocol, tool approvals, persistence boundaries, UI message parts, and eval flows end to end.

Relevant primary docs:

- OpenAI latest model guide: `https://developers.openai.com/api/docs/guides/latest-model?model=gpt-5.6`
- OpenAI GPT-5.6 migration guide: `https://developers.openai.com/api/docs/guides/upgrading-to-gpt-5p6-sol`
- OpenAI GPT-5.6 prompting guidance: `https://developers.openai.com/api/docs/guides/prompt-guidance-gpt-5p6`
- AI SDK tool calling: `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`
