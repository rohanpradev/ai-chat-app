import type { GetChatResponse } from "@chat-app/shared";
import { queryOptions } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";

export const getChatQuery = (chatId: string) => {
  const { callApi } = useApi();
  return queryOptions<GetChatResponse>({
    queryKey: ["chat", chatId],
    queryFn: () => callApi(`chats/${chatId}`, { method: "GET" }, false),
    enabled: !!chatId,
  });
};
