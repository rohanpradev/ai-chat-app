import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";
import { Route as ChatIndexRoute } from "@/routes/chat/index";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/")({
  validateSearch: searchSchema,
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
