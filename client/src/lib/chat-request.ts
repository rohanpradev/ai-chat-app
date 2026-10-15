import type { AgentMode } from "@chat-app/shared/agents";
import type { AiTextStreamRequestBody } from "@chat-app/shared/api-contract";
import type { AIModelId } from "@chat-app/shared/models";
import { webSearchToolId } from "@chat-app/shared/tool-ids";

interface ChatRequestBodyOptions {
  conversationId?: string;
  agentMode: AgentMode;
  model: AIModelId;
  webSearch: boolean;
  mcp?: boolean;
}

type ChatRequestBody = {
  agentMode: AiTextStreamRequestBody["agentMode"];
  chatId?: AiTextStreamRequestBody["chatId"];
  model: AiTextStreamRequestBody["model"];
  tools?: AiTextStreamRequestBody["tools"];
};

export const buildChatRequestBody = ({
  conversationId,
  agentMode,
  model,
  webSearch,
  mcp = false,
}: ChatRequestBodyOptions): ChatRequestBody => ({
  agentMode,
  model,
  ...(webSearch || mcp ? { tools: [...(webSearch ? [webSearchToolId] : []), ...(mcp ? ["mcp" as const] : [])] } : {}),
  ...(conversationId ? { chatId: conversationId } : {}),
});
