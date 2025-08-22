import { useMutation } from "@tanstack/react-query";

export function useLoadConversation() {
  return useMutation({
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
