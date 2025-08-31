import type { CreateConversationResponse } from "@chat-app/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export const useCreateChat = () => {
  const { callApi } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (title: string = "New Chat") =>
      callApi<CreateConversationResponse>("conversations", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      // Invalidate the conversations list query to trigger a refetch
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY.chats });
    },
  });
};

export const createChatQuery = (title: string = "New Chat") => {
  const { callApi } = useApi();
  return queryOptions({
    // Unique key per execution to avoid returning a stale created record when navigating repeatedly
    queryKey: [...CHAT_QUERY_KEY.createChat, title, Date.now()],
    queryFn: () =>
      callApi<CreateConversationResponse>(
        "conversations",
        {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ title }),
        },
        false,
      ),
    // We don't want this to stick around
    gcTime: 0,
    staleTime: 0,
  });
};
