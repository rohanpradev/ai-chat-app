import type { AgentMode } from "@chat-app/shared/agents";
import type { AIModelId } from "@chat-app/shared/models";
import type { ChatRequest } from "@chat-app/shared/schemas/ai.schema";
import { webSearchToolId } from "@chat-app/shared/tool-ids";

export interface ChatRequestBodyOptions {
  conversationId?: string;
  agentMode: AgentMode;
  model: AIModelId;
  webSearch: boolean;
}

type ChatRequestBody = {
  agentMode: ChatRequest["agentMode"];
  chatId?: ChatRequest["chatId"];
  model: ChatRequest["model"];
  tools?: ChatRequest["tools"];
};

export const buildChatRequestBody = ({
  conversationId,
  agentMode,
  model,
  webSearch,
}: ChatRequestBodyOptions): ChatRequestBody => ({
  agentMode,
  model,
  ...(webSearch ? { tools: [webSearchToolId] } : {}),
  ...(conversationId ? { chatId: conversationId } : {}),
});
