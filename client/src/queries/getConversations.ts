import type { Conversation } from "@chat-app/shared";
import { queryOptions } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export const getConversationsQuery = () => {
  const { callApi } = useApi();
  return queryOptions<{ data: Conversation[]; message: string }>({
    queryKey: CHAT_QUERY_KEY.conversations,
    queryFn: () =>
      callApi(
        "conversations",
        {
          method: "GET",
        },
        false,
      ),
  });
};
