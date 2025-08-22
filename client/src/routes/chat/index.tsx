import { createFileRoute, redirect } from "@tanstack/react-router";
import { Route as NewChatRoute } from "@/routes/chat/new";

export const Route = createFileRoute("/chat/")({
  beforeLoad: () => {
    throw redirect({ to: NewChatRoute.to });
  },
});
