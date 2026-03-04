import { jwt } from "hono/jwt";

import env from "@/utils/env";

export const authMiddleware = jwt({
  alg: "HS256",
  cookie: env.AUTH_COOKIE_NAME,
  secret: env.JWT_SECRET,
});
