import { queryOptions } from "@tanstack/react-query";
import { getApiClient } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export const getChatsQuery = () => {
  const api = getApiClient();
  return queryOptions({
    queryKey: CHAT_QUERY_KEY.chats,
    queryFn: ({ signal }) => api.conversations.list(signal),
  });
};
