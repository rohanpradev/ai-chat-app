import type { GetConversationsResponse } from "@chat-app/shared/types/conversation.types";
import { queryOptions } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export const getConversationsQuery = () => {
  const { callApi } = useApi();
  return queryOptions({
    queryKey: CHAT_QUERY_KEY.chats,
    queryFn: () =>
      callApi<GetConversationsResponse>("conversations", {
        method: "GET",
      }),
  });
};
