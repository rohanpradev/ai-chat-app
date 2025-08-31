import { createFileRoute, redirect } from "@tanstack/react-router";
import { createChatQuery } from "@/queries/createChat";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";
import { Route as ChatIndexRoute } from "@/routes/chat/index";

export const Route = createFileRoute("/chat/new")({
  loader: async ({ context }) => {
    try {
      const { id } = await context.queryClient.fetchQuery(createChatQuery("New Chat"));
      if (id) {
        throw redirect({
          to: ConversationRoute.to,
          params: { conversationId: id },
          search: { redirect: undefined },
          replace: true,
        });
      }
      throw redirect({ to: ChatIndexRoute.to, search: { redirect: undefined }, replace: true });
    } catch (error) {
      // If there's an error creating the conversation, go back to chat index
      if (error instanceof Error && "to" in error) {
        throw error; // Re-throw redirect errors
      }
      throw redirect({ to: ChatIndexRoute.to, search: { redirect: undefined }, replace: true });
    }
  },
});
