import { jwt } from "hono/jwt";

import { asAppMiddleware } from "@/lib/hono-compat";
import type { AppMiddleware } from "@/lib/types";
import env from "@/utils/env";

export const authMiddleware: AppMiddleware = asAppMiddleware(
  jwt({
    alg: "HS256",
    cookie: env.AUTH_COOKIE_NAME,
    secret: env.JWT_SECRET,
  }),
);
