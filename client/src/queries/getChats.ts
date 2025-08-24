import type { GetChatsResponse } from "@chat-app/shared";
import { queryOptions } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";

export const getChatsQuery = () => {
  const { callApi } = useApi();
  return queryOptions<GetChatsResponse>({
    queryKey: ["chats"],
    queryFn: () => callApi("chats/all", { method: "GET" }, false),
  });
};
