import {
	AIStreamResponseHeaders,
	AITextResponseSchema,
	ChatRequestSchema,
	CommonUnauthorizedResponseSchema
} from "@chat-app/shared";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { notFoundSchema } from "@/lib/constants";
import { authMiddleware } from "@/middlewares/auth-middleware";

const tags = ["AI"];

export const ai = createRoute({
	description: "AI Text Endpoint",
	method: "post",
	middleware: [authMiddleware],
	path: "/ai/text",
	request: {
		body: jsonContent(ChatRequestSchema, "Schema for ai chat request with model and webSearch")
	},
	responses: {
		[HttpStatusCodes.NO_CONTENT]: { description: "No information Provided" },
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "AI not found"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized"),
		[HttpStatusCodes.OK]: jsonContent(AITextResponseSchema, "Response by the model")
	},
	security: [{ CookieAuth: [] }],
	summary: "This endpoint streams plain text data based on a given prompt.",
	tags
});

export const aiStream = createRoute({
	description: "AI text stream API",
	method: "post",
	middleware: [authMiddleware],
	path: "/ai/text-stream",
	request: {
		body: jsonContent(ChatRequestSchema, "Schema for ai chat request with model and webSearch")
	},
	responses: {
		[HttpStatusCodes.NO_CONTENT]: { description: "No information provided" },
		[HttpStatusCodes.NOT_FOUND]: jsonContent(notFoundSchema, "AI not found"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized"),
		[HttpStatusCodes.OK]: {
			content: {
				"text/plain": {
					schema: {
						description: "Server-Sent Events stream with data: prefixed lines containing JSON objects with text chunks",
						example:
							'data: {"type":"text-delta","textDelta":"Hello"}\\n\\ndata: {"type":"text-delta","textDelta":" world"}\\n\\ndata: {"type":"finish","finishReason":"stop"}\\n\\n',
						type: "string"
					}
				}
			},
			description: "A stream of text chunks",
			headers: AIStreamResponseHeaders
		}
	},
	security: [{ CookieAuth: [] }],
	summary: "This endpoint streams plain text data based on a given prompt.",
	tags
});

export type AIRoute = typeof ai;
export type AIStreamRoute = typeof aiStream;
