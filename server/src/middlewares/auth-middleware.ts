import * as Sentry from "@sentry/bun";
import { jwt } from "hono/jwt";

import { asAppMiddleware } from "@/lib/hono-compat";
import type { AppMiddleware } from "@/lib/types";
import env from "@/utils/env";

const jwtMiddleware = asAppMiddleware(
	jwt({
		alg: "HS256",
		cookie: env.AUTH_COOKIE_NAME,
		secret: env.JWT_SECRET
	})
);

export const authMiddleware: AppMiddleware = async (c, next) => {
	await jwtMiddleware(c, async () => {
		const user = c.get("jwtPayload")?.sub;

		if (user) {
			c.set("user", user);
			Sentry.setUser({ id: user.id });
		} else {
			Sentry.setUser(null);
		}

		await next();
	});
};
