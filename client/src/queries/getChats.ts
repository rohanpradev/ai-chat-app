import type { Chat } from "@chat-app/shared";
import { queryOptions } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export const getChatsQuery = () => {
  const { callApi } = useApi();
  return queryOptions({
    queryKey: CHAT_QUERY_KEY.chats,
    queryFn: () =>
      callApi<{ data: Chat[]; message: string }>(
        "conversations",
        {
          method: "GET",
        }
      ),
  });
};
