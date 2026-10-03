# Model Policy

## Source of Truth

The approved chat model catalog lives in `shared/models.ts`. The server may check the OpenAI model list at runtime, but it only exposes approved IDs from that shared catalog.

## Default Model

The low-cost default chat model is `openai/gpt-5-mini`, routed through Vercel AI Gateway. The embedding model is `openai/text-embedding-3-small`, also routed through Gateway. The dropdown reads currently available Gateway language models.

The model list is owned by Vercel AI Gateway. A model must appear as `type: language` in the account's Gateway catalog to be shown in the chat selector. Keep `openai/gpt-5-mini` as the fallback because it is a small, inexpensive option.

The default chat model should be capable of:

- Tool calling
- Streaming
- Reasoning over multi-step agent workflows
- Structured output support for future extraction and eval flows

When changing `defaultModelId`, run the eval checklist in `docs/evals.md` and verify the UI can still stream text, tool calls, tool results, sources, and metadata.

## Upgrade Rules

- Prefer explicit model IDs over ambiguous aliases for reproducible releases.
- Try a listed Gateway model in the selector and run the eval checklist before changing the shared fallback.
- Keep older fallback models available until the replacement passes chat, tool, RAG, and latency checks.
- Do not upgrade model strings and SDK major versions in the same PR unless the SDK migration requires it.
- Record major model changes in release notes with expected behavior, cost, latency, and tool-calling differences.
- Benchmark candidate models against representative tasks for quality, token use, end-to-end latency, tool-call precision, and refusal behavior.

## AI SDK Channel

This repo tracks the stable AI SDK 7 line. SDK major upgrades remain migration work; patch updates can use the normal dependency process, including the repository's release-age gate and committed lockfile. Before upgrading a major, verify the streaming protocol, tool approvals, persistence boundaries, UI message parts, and eval flows end to end.

Relevant primary docs:

- Vercel AI Gateway SDKs and APIs: `https://vercel.com/docs/ai-gateway/sdks-and-apis`
- Vercel AI Gateway model listing: `https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-chat-completions/rest-api`
- AI SDK tool calling: `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`
