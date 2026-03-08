export interface ChatRequestBodyOptions {
  conversationId?: string;
  model: string;
  selectedTools: string[];
  webSearch: boolean;
}

export const buildChatRequestBody = ({ conversationId, model, selectedTools, webSearch }: ChatRequestBodyOptions) => ({
  model,
  tools: selectedTools,
  webSearch,
  ...(conversationId ? { chatId: conversationId } : {}),
});
