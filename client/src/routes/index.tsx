import { createFileRoute, redirect } from "@tanstack/react-router";
import { redirectSearchValidator } from "@/lib/router-search";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";
import { Route as ChatIndexRoute } from "@/routes/chat/index";

export const Route = createFileRoute("/")({
  validateSearch: redirectSearchValidator,
  beforeLoad: ({ context, search }) => {
    const redirectTo = search.redirect || ChatIndexRoute.to;

    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: LoginRoute.to,
        search: { redirect: redirectTo },
      });
    }

    throw redirect({ to: redirectTo });
  },
});
