import { jwt } from "hono/jwt";

import env from "@/utils/env";

export const authMiddleware = jwt({
	cookie: env.AUTH_COOKIE_NAME,
	secret: env.JWT_SECRET
});
