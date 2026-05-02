import { queryOptions } from "@tanstack/react-query";
import { ApiRequestError, getApiClient } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export const getConversationQuery = (conversationId: string) => {
  const api = getApiClient();

  return queryOptions({
    gcTime: 5 * 60 * 1000,
    queryFn: () => api.conversations.get(conversationId),
    queryKey: CHAT_QUERY_KEY.conversation(conversationId),
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      const status = error instanceof ApiRequestError ? error.status : undefined;
      if (status === 404 || status === 403) {
        return false;
      }

      return failureCount < 2;
    },
    staleTime: 30 * 1000,
  });
};
