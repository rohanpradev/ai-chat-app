import { defaultAgentMode, defaultModelId, webSearchToolId } from "@chat-app/shared";
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
        model: "gpt-4o",
        webSearch: true,
      }),
    ).toEqual({
      agentMode: "research",
      chatId: "chat-123",
      model: "gpt-4o",
      tools: [webSearchToolId],
    });
  });
});
