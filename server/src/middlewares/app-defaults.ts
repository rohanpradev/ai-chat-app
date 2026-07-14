import type { ErrorHandler, MiddlewareHandler, NotFoundHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import env from "@/utils/env";

const escapeSvgText = (value: string): string =>
	value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");

export const serveEmojiFavicon = (emoji: string): MiddlewareHandler => {
	return async (c, next) => {
		if (c.req.path === "/favicon.ico") {
			c.res.headers.set("content-type", "image/svg+xml");
			const safeEmoji = escapeSvgText(Array.from(emoji).slice(0, 2).join(""));
			return c.body(
				`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" x="-0.1em" font-size="90">${safeEmoji}</text></svg>`
			);
		}

		return next();
	};
};

export const notFound: NotFoundHandler = (c) => {
	return c.json(
		{
			message: `Not Found - ${c.req.path}`
		},
		HttpStatusCodes.NOT_FOUND
	);
};

export const onError: ErrorHandler = (error, c) => {
	const isHttpException = error instanceof HTTPException;
	const statusCode = isHttpException ? (error.status as ContentfulStatusCode) : HttpStatusCodes.INTERNAL_SERVER_ERROR;
	const logger = c.get("logger");
	const isServerError = statusCode >= HttpStatusCodes.INTERNAL_SERVER_ERROR;

	if (logger) {
		const logContext = {
			error,
			method: c.req.method,
			path: c.req.path,
			statusCode
		};

		if (isServerError) {
			logger.error(logContext, "Request failed");
		} else {
			logger.warn(logContext, "Request rejected");
		}
	}

	if (isHttpException) {
		const exceptionResponse = error.getResponse();
		for (const [name, value] of exceptionResponse.headers) {
			c.header(name, value);
		}
	}

	return c.json(
		{
			message: isServerError ? "Internal server error" : error.message,
			stack: env.NODE_ENV === "production" ? undefined : error.stack
		},
		statusCode as ContentfulStatusCode
	);
};
