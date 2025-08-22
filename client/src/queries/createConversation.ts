import type { CreateConversationResponse } from "@chat-app/shared";
import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export const useCreateConversation = () => {
  const { callApi } = useApi();
  const queryClient = useQueryClient();

  return useMutation<CreateConversationResponse, Error, string>({
    mutationFn: (title: string = "New Conversation") =>
      callApi<CreateConversationResponse>("conversations", {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ title }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY.conversations });
    },
  });
};

export const createConversationQuery = (title: string = "New Conversation") => {
  const { callApi } = useApi();
  return queryOptions<CreateConversationResponse>({
    // Unique key per execution to avoid returning a stale created record when navigating repeatedly
    queryKey: [...CHAT_QUERY_KEY.createConversation, title, Date.now()],
    queryFn: () =>
      callApi<CreateConversationResponse>(
        "conversations",
        {
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ title }),
        },
        /* extractData */ false,
      ),
    // We don't want this to stick around
    gcTime: 0,
    staleTime: 0,
  });
};
