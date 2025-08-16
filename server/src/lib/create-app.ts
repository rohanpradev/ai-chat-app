import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import type { AppBindings } from "@/lib/types";

import { pinoLogger } from "@/middlewares/pino-logger";
import env from "@/utils/env";

export function createRouter() {
	return new OpenAPIHono<AppBindings>({ defaultHook, strict: false });
}

export function createApp() {
	const app = createRouter();

	app.use(serveEmojiFavicon("🔥"));

	app.use(pinoLogger());

	app.use(secureHeaders({ crossOriginEmbedderPolicy: false }));

	app.use(
		cors({
			credentials: true,
			maxAge: 86400,
			origin: [env.CLIENT_URL]
		})
	);

	app.use(etag());
	app.use(timeout(30000));

	app.get("/health", (c) => c.json({ status: "ok" }));

	app.notFound(notFound);
	app.onError(onError);

	return app;
}
