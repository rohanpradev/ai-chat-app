import type { RouteConfig } from "@hono/zod-openapi";
import type { ErrorHandler, MiddlewareHandler, NotFoundHandler } from "hono";
import type { AppBindings } from "@/lib/types";

type RouteMiddleware = Extract<NonNullable<RouteConfig["middleware"]>, (...args: never[]) => unknown>;

export const asAppMiddleware = (middleware: MiddlewareHandler): MiddlewareHandler<AppBindings> =>
	middleware as unknown as MiddlewareHandler<AppBindings>;

export const asRouteMiddleware = (middleware: MiddlewareHandler<AppBindings>) =>
	middleware as unknown as RouteMiddleware;

export const asAppErrorHandler = (handler: ErrorHandler): ErrorHandler<AppBindings> =>
	handler as unknown as ErrorHandler<AppBindings>;

export const asAppNotFoundHandler = (handler: NotFoundHandler): NotFoundHandler<AppBindings> =>
	handler as unknown as NotFoundHandler<AppBindings>;
