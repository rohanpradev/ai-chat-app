import type { MiddlewareHandler } from "hono";

export const langfuseMiddleware = (): MiddlewareHandler => {
	return async (c, next) => {
		const traceId = c.req.header("x-trace-id") || Bun.randomUUIDv7();

		// Set trace ID in response headers for client reference
		c.header("x-trace-id", traceId);

		// Store trace context in the request context
		c.set("traceId", traceId);

		// Add timing information
		const startTime = Date.now();
		c.set("requestStartTime", startTime);

		await next();

		// Add response timing
		const duration = Date.now() - startTime;
		c.header("x-response-time", `${duration}ms`);
	};
};
