import { defaultAgentMode } from "@chat-app/shared/agents";
import { defaultModelId } from "@chat-app/shared/models";
import { webSearchToolId } from "@chat-app/shared/tool-ids";
import { describe, expect, it } from "vitest";
import { buildChatRequestBody } from "@/lib/chat-request";

describe("buildChatRequestBody", () => {
  it("uses the selected agent and model for the server request", () => {
    expect(
      buildChatRequestBody({
        agentMode: defaultAgentMode,
        model: defaultModelId,
        webSearch: false,
      }),
    ).toEqual({
      agentMode: defaultAgentMode,
      model: defaultModelId,
    });
  });

  it("maps the active conversation to chatId and enables web search tools", () => {
    expect(
      buildChatRequestBody({
        conversationId: "chat-123",
        agentMode: "research",
        model: "openai/gpt-5-mini",
        webSearch: true,
      }),
    ).toEqual({
      agentMode: "research",
      chatId: "chat-123",
      model: "openai/gpt-5-mini",
      tools: [webSearchToolId],
    });
  });
});

it("sends MCP only when explicitly enabled and composes it with web search", () => {
  const base = { agentMode: "assistant" as const, model: "openai/gpt-5-mini", webSearch: false };
  expect(buildChatRequestBody(base).tools).toBeUndefined();
  expect(buildChatRequestBody({ ...base, mcp: true }).tools).toEqual(["mcp"]);
  expect(buildChatRequestBody({ ...base, mcp: true, webSearch: true }).tools).toEqual(["serper", "mcp"]);
});
