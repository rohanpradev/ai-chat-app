import { queryOptions } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export const getChatsQuery = () => {
  const api = useApi();
  return queryOptions({
    queryKey: CHAT_QUERY_KEY.chats,
    queryFn: () => api.conversations.list(),
  });
};
