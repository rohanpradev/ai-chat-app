import { createFileRoute, redirect } from "@tanstack/react-router";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";
import { Route as ChatRoute } from "@/routes/chat";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: LoginRoute.to });
    }
    throw redirect({ to: ChatRoute.to });
  },
});
