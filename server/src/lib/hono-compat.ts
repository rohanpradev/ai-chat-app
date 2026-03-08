import type { ErrorHandler, Handler, MiddlewareHandler, NotFoundHandler } from "hono";
import type { AppBindings } from "@/lib/types";

export const asAppMiddleware = (middleware: MiddlewareHandler): MiddlewareHandler<AppBindings> =>
	middleware as unknown as MiddlewareHandler<AppBindings>;

export const asRouteMiddleware = (middleware: MiddlewareHandler<AppBindings>): Handler =>
	middleware as unknown as Handler;

export const asAppErrorHandler = (handler: ErrorHandler): ErrorHandler<AppBindings> =>
	handler as unknown as ErrorHandler<AppBindings>;

export const asAppNotFoundHandler = (handler: NotFoundHandler): NotFoundHandler<AppBindings> =>
	handler as unknown as NotFoundHandler<AppBindings>;
