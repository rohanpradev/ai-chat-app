import { useMutation } from "@tanstack/react-query";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

export function useLoadConversation() {
  return useMutation({
    mutationKey: CHAT_QUERY_KEY.loadConversation,
    mutationFn: async (conversationId: string) => {
      const response = await fetch(`/api/conversations/${conversationId}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load conversation");
      }
      return response.json();
    },
  });
}
