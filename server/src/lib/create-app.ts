import { OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { etag, RETAINED_304_HEADERS } from "hono/etag";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { asAppErrorHandler, asAppMiddleware, asAppNotFoundHandler } from "@/lib/hono-compat";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import { isShuttingDown } from "@/lib/lifecycle";
import { defaultHook } from "@/lib/openapi";
import { setupSentryForHono } from "@/lib/sentry";
import type { AppBindings } from "@/lib/types";
import { notFound, onError, serveEmojiFavicon } from "@/middlewares/app-defaults";
import { pinoLogger } from "@/middlewares/pino-logger";
import env from "@/utils/env";

export function createRouter() {
	return new OpenAPIHono<AppBindings>({ defaultHook, strict: false });
}

export function createApp() {
	const app = createRouter();
	const useAppMiddleware = (middleware: MiddlewareHandler<AppBindings, "*">) => app.use("*", middleware);
	const apiPathPrefix = `/${env.BASE_API_SLUG}`;

	useAppMiddleware(
		asAppMiddleware(
			requestId({
				generator: () => Bun.randomUUIDv7(),
				limitLength: 128
			})
		)
	);
	setupSentryForHono(app);

	useAppMiddleware(asAppMiddleware(serveEmojiFavicon("🔥")));

	useAppMiddleware(pinoLogger());

	useAppMiddleware(
		asAppMiddleware(
			bodyLimit({
				maxSize: 25 * 1024 * 1024,
				onError: (c) => c.json({ message: "Request body must be 25MB or smaller" }, HttpStatusCodes.PAYLOAD_TOO_LARGE)
			})
		)
	);

	useAppMiddleware(
		asAppMiddleware(
			secureHeaders({
				crossOriginEmbedderPolicy: false
			})
		)
	);

	// Allow comma-separated CORS origins via CORS_ORIGINS; fallback to CLIENT_URL
	const allowedOrigins = env.CORS_ORIGINS
		? env.CORS_ORIGINS.split(",")
				.map((origin) => origin.trim())
				.filter(Boolean)
		: [env.CLIENT_URL];
	const allowAnyOrigin = allowedOrigins.includes("*");
	if (env.NODE_ENV === "production" && allowAnyOrigin) {
		throw new Error("CORS_ORIGINS cannot include '*' in production when credentialed cookies are enabled");
	}

	const corsAllowHeaders = [
		"Accept",
		"Authorization",
		"Baggage",
		"Content-Type",
		"Origin",
		"Sentry-Trace",
		"X-Request-ID",
		"X-Requested-With"
	];
	const corsAllowMethods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
	const corsExposeHeaders = ["Content-Length", "Content-Type", "X-Request-ID"];
	const isAllowedOrigin = (origin: string) => allowAnyOrigin || allowedOrigins.includes(origin);

	useAppMiddleware(
		asAppMiddleware(
			cors({
				allowHeaders: corsAllowHeaders,
				allowMethods: corsAllowMethods,
				credentials: true,
				exposeHeaders: corsExposeHeaders,
				maxAge: 86400,
				origin: (origin) => {
					if (!origin) {
						return env.CLIENT_URL;
					}

					return isAllowedOrigin(origin) ? origin : null;
				}
			})
		)
	);

	const csrfMiddleware = asAppMiddleware(
		csrf({
			origin: (origin) => {
				if (!origin) {
					return false;
				}

				return isAllowedOrigin(origin);
			},
			secFetchSite: ["same-origin", "same-site", "none"]
		})
	);
	const authPathPrefix = `${apiPathPrefix}/auth/`;

	useAppMiddleware(async (c, next) => {
		if (c.req.path.startsWith(authPathPrefix)) {
			await next();
			return;
		}

		await csrfMiddleware(c, next);
	});

	const etagMiddleware = asAppMiddleware(
		etag({
			retainedHeaders: [
				...RETAINED_304_HEADERS,
				"access-control-allow-credentials",
				"access-control-allow-origin",
				"x-request-id"
			]
		})
	);
	useAppMiddleware(async (c, next) => {
		if (c.req.method !== "GET" && c.req.method !== "HEAD") {
			await next();
			return;
		}

		await next();

		const contentType = c.res.headers.get("content-type")?.toLowerCase();
		const cacheControl = c.res.headers.get("cache-control")?.toLowerCase();
		const isSuccessfulResponse = c.res.status >= 200 && c.res.status < 300 && c.res.status !== 204;
		const isEventStream = contentType?.startsWith("text/event-stream") ?? false;
		const forbidsStorage = cacheControl?.split(",").some((directive) => directive.trim() === "no-store") ?? false;

		if (!isSuccessfulResponse || isEventStream || forbidsStorage) {
			return;
		}

		await etagMiddleware(c, async () => {});
	});

	useAppMiddleware(async (c, next) => {
		await next();

		const isApiResponse = c.req.path.startsWith(`${apiPathPrefix}/`);
		const isHealthCheck = c.req.path === `${apiPathPrefix}/health`;
		if (isApiResponse && !isHealthCheck) {
			c.header("Cache-Control", "no-store");
		}
	});

	const requestTimeout = asAppMiddleware(timeout(180_000));
	const aiStreamPath = `${apiPathPrefix}/ai/text-stream`;
	useAppMiddleware(async (c, next) => {
		if (c.req.path === aiStreamPath) {
			await next();
			return;
		}

		await requestTimeout(c, next);
	});

	const healthResponse = { status: "ok" } as const;
	const readyResponse = { status: "ready" } as const;
	const shuttingDownResponse = { status: "shutting_down" } as const;
	app.get("/health", (c) => c.json(healthResponse));
	app.get(`${apiPathPrefix}/health`, (c) => c.json(healthResponse));
	app.get("/ready", (c) =>
		isShuttingDown()
			? c.json(shuttingDownResponse, HttpStatusCodes.SERVICE_UNAVAILABLE)
			: c.json(readyResponse, HttpStatusCodes.OK)
	);
	app.get(`${apiPathPrefix}/ready`, (c) =>
		isShuttingDown()
			? c.json(shuttingDownResponse, HttpStatusCodes.SERVICE_UNAVAILABLE)
			: c.json(readyResponse, HttpStatusCodes.OK)
	);

	app.notFound(asAppNotFoundHandler(notFound));
	app.onError(asAppErrorHandler(onError));

	return app;
}
