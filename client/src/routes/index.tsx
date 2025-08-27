import { createFileRoute, redirect } from "@tanstack/react-router";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";
import { Route as ChatIndexRoute } from "@/routes/chat/index";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
  beforeLoad: ({ context, search }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: LoginRoute.to,
        search: {
          redirect: search.redirect || ChatIndexRoute.to,
        },
      });
    }
    // If user is authenticated, redirect to their intended destination or chat
    const redirectTo = search.redirect || ChatIndexRoute.to;
    throw redirect({ to: redirectTo });
  },
});
