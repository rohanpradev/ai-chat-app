import * as Sentry from "@sentry/bun";
import { HTTPException } from "hono/http-exception";

import { auth } from "@/lib/auth";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import type { AppMiddleware } from "@/lib/types";

export const authMiddleware: AppMiddleware = async (c, next) => {
	const session = await auth.api.getSession({
		headers: c.req.raw.headers
	});

	if (!session) {
		Sentry.setUser(null);
		throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
			message: "Please log in to continue."
		});
	}

	const user = {
		email: session.user.email,
		id: session.user.id,
		image: session.user.image ?? null,
		name: session.user.name
	};

	c.set("user", user);
	c.set("session", session.session);
	c.set("jwtPayload", {
		exp: Math.floor(session.session.expiresAt.getTime() / 1000),
		sub: user
	});

	Sentry.setUser({ id: user.id });
	await next();
};
