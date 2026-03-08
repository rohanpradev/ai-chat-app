import { OpenAPIHono } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { etag } from "hono/etag";
import { secureHeaders } from "hono/secure-headers";
import { timeout } from "hono/timeout";
import { notFound, onError, serveEmojiFavicon } from "stoker/middlewares";
import { defaultHook } from "stoker/openapi";
import {
  asAppErrorHandler,
  asAppMiddleware,
  asAppNotFoundHandler,
} from "@/lib/hono-compat";
import type { AppBindings } from "@/lib/types";

import { pinoLogger } from "@/middlewares/pino-logger";
import env from "@/utils/env";

export function createRouter() {
  return new OpenAPIHono<AppBindings>({ defaultHook, strict: false });
}

export function createApp() {
  const app = createRouter();
  const useAppMiddleware = (middleware: MiddlewareHandler<AppBindings>) =>
    app.use("*", middleware);

  useAppMiddleware(asAppMiddleware(serveEmojiFavicon("🔥")));

  useAppMiddleware(pinoLogger());

  useAppMiddleware(
    asAppMiddleware(
      secureHeaders({
        crossOriginEmbedderPolicy: false,
      }),
    ),
  );

  // Allow comma-separated CORS origins via CORS_ORIGINS; fallback to CLIENT_URL
  const allowedOrigins = (
    Bun.env.CORS_ORIGINS
      ? Bun.env.CORS_ORIGINS.split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [env.CLIENT_URL]
  ) as string[];

  useAppMiddleware(
    asAppMiddleware(
      cors({
        credentials: true,
        maxAge: 86400,
        origin: allowedOrigins,
      }),
    ),
  );

  useAppMiddleware(asAppMiddleware(etag()));
  useAppMiddleware(asAppMiddleware(timeout(30000)));

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.notFound(asAppNotFoundHandler(notFound));
  app.onError(asAppErrorHandler(onError));

  return app;
}
