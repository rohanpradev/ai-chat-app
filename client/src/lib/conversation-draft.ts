export interface ConversationDraft {
  text: string;
  autoSend: boolean;
}

// Draft content lives only in the current tab's query cache, never in a URL.
export const conversationDraftKey = (userId: string, conversationId: string) =>
  ["conversation-draft", userId, conversationId] as const;
