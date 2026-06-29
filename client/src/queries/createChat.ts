import type { ConversationDetail, ConversationSummary } from "@chat-app/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { getApiClient } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export const useCreateChat = () => {
  const api = getApiClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: CHAT_QUERY_KEY.createChat,
    mutationFn: (title: string = "New Chat") => api.conversations.create({ title }),
    onSuccess: async (data) => {
      const createdConversation: ConversationSummary = data;

      queryClient.setQueryData<ConversationSummary[]>(CHAT_QUERY_KEY.chats, (current) => {
        return [createdConversation, ...(current ?? []).filter((conversation) => conversation.id !== data.id)];
      });

      queryClient.setQueryData<ConversationDetail>(CHAT_QUERY_KEY.conversation(data.id), data);
      await queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY.chats });
    },
  });
};
