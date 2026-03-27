import { type AgentMode, type AIModelId, type ChatRequest, webSearchToolId } from "@chat-app/shared";

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
