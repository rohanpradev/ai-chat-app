import type { ConversationSummary } from "@chat-app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export function useDeleteChat() {
  const api = getApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: CHAT_QUERY_KEY.deleteChat,
    mutationFn: (conversationId: string) => api.conversations.delete(conversationId),
    onSuccess: ({ id }) => {
      queryClient.setQueryData<ConversationSummary[]>(CHAT_QUERY_KEY.chats, (current) =>
        current?.filter((conversation) => conversation.id !== id),
      );
      queryClient.removeQueries({ queryKey: CHAT_QUERY_KEY.conversation(id) });
    },
  });
}
