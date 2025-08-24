import { createFileRoute, redirect } from "@tanstack/react-router";
import { generateId } from "ai";
import { Route as ChatRoute } from "@/routes/chat/$conversationId";

export const Route = createFileRoute("/chat/new")({
  beforeLoad: () => {
    const chatId = generateId();
    throw redirect({ to: ChatRoute.to, params: { conversationId: chatId } });
  },
});
