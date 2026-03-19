import { webSearchToolId } from "@chat-app/shared";

export interface ChatRequestBodyOptions {
  conversationId?: string;
  model: string;
  webSearch: boolean;
}

export const buildChatRequestBody = ({ conversationId, model, webSearch }: ChatRequestBodyOptions) => ({
  model,
  ...(webSearch ? { tools: [webSearchToolId] } : {}),
  ...(conversationId ? { chatId: conversationId } : {}),
});
