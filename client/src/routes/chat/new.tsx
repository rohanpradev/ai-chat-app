import type { CreateConversationResponse } from "@chat-app/shared";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createConversationQuery } from "@/queries/createConversation";
import { Route as ChatRoute } from "@/routes/chat";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";

export const Route = createFileRoute("/chat/new")({
  loader: async ({ context }) => {
    const result = await context.queryClient.ensureQueryData(createConversationQuery("New Conversation"));
    const id = (result as CreateConversationResponse)?.data?.id;
    if (id) {
      throw redirect({ to: ConversationRoute.to, params: { conversationId: id } });
    }
    throw redirect({ to: ChatRoute.to });
  },
});
