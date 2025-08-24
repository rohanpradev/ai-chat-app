import {
	ChatErrorResponseSchema,
	GetChatRequestSchema,
	GetChatResponseSchema,
	GetChatsResponseSchema,
	UpsertChatRequestSchema,
	UpsertChatResponseSchema
} from "@chat-app/shared";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { authMiddleware } from "@/middlewares/auth-middleware";

const tags = ["Chats"];

export const upsertChatRoute = createRoute({
	description: "Create or update a chat",
	method: "post",
	middleware: [authMiddleware],
	path: "/chat",
	request: {
		body: jsonContent(UpsertChatRequestSchema, "Chat creation or update data")
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(UpsertChatResponseSchema, "Chat created"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ChatErrorResponseSchema, "Unauthorized"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(ChatErrorResponseSchema, "Invalid input")
	},
	summary: "Create new chat",
	tags
});

export type UpsertChatRoute = typeof upsertChatRoute;

export const getChatsRoute = createRoute({
	description: "Get all chats for authenticated user",
	method: "get",
	middleware: [authMiddleware],
	path: "/chats/all",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(GetChatsResponseSchema, "List of chats"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ChatErrorResponseSchema, "Unauthorized")
	},
	summary: "Get user chats",
	tags
});

export type GetChatsRoute = typeof getChatsRoute;

export const getChatRoute = createRoute({
	description: "Get specific chat by ID",
	method: "get",
	middleware: [authMiddleware],
	path: "/chats/{chatId}",
	request: {
		params: GetChatRequestSchema
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(GetChatResponseSchema, "Chat details"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ChatErrorResponseSchema, "Unauthorized")
	},
	summary: "Get chat by ID",
	tags
});

export type GetChatRoute = typeof getChatRoute;
