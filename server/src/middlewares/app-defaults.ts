import type { ErrorHandler, MiddlewareHandler, NotFoundHandler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as HttpStatusCodes from "@/lib/http-status-codes";

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
	const currentStatus =
		"status" in error && typeof error.status === "number" ? error.status : c.newResponse(null).status;
	const statusCode =
		currentStatus === HttpStatusCodes.OK
			? HttpStatusCodes.INTERNAL_SERVER_ERROR
			: (currentStatus as ContentfulStatusCode);

	return c.json(
		{
			message: error.message,
			stack: Bun.env.NODE_ENV === "production" ? undefined : error.stack
		},
		statusCode as ContentfulStatusCode
	);
};
