import {
	ChatBadRequestResponseSchema,
	ChatErrorResponseSchema,
	CreateConversationRequestSchema,
	CreateConversationResponseSchema,
	DeleteConversationResponseSchema,
	GetConversationResponseSchema,
	GetConversationsResponseSchema,
	UpdateConversationRequestSchema,
	UpdateConversationResponseSchema
} from "@chat-app/shared";
import { createRoute, z } from "@hono/zod-openapi";
import { asRouteMiddleware } from "@/lib/hono-compat";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import { jsonBody, jsonContent } from "@/lib/openapi";
import { authMiddleware } from "@/middlewares/auth-middleware";

const tags = ["Conversations"];
const authenticated = asRouteMiddleware(authMiddleware);
const conversationIdParam = z.object({
	id: z.string().openapi({
		param: {
			description: "Conversation ID",
			in: "path",
			name: "id",
			required: true
		}
	})
});

export const createConversationRoute = createRoute({
	description: "Create a new conversation",
	method: "post",
	middleware: [authenticated],
	path: "/conversations",
	request: {
		body: jsonBody(CreateConversationRequestSchema, "Conversation creation data")
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(CreateConversationResponseSchema, "Conversation created"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ChatErrorResponseSchema, "Unauthorized"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(ChatBadRequestResponseSchema, "Invalid input")
	},
	security: [{ CookieAuth: [] }],
	summary: "Create new conversation",
	tags
});

export type CreateConversationRoute = typeof createConversationRoute;

export const getConversationsRoute = createRoute({
	description: "Get all conversations for authenticated user",
	method: "get",
	middleware: [authenticated],
	path: "/conversations",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(GetConversationsResponseSchema, "List of conversations"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ChatErrorResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Get user conversations",
	tags
});

export type GetConversationsRoute = typeof getConversationsRoute;

export const getConversationRoute = createRoute({
	description: "Get specific conversation by ID",
	method: "get",
	middleware: [authenticated],
	path: "/conversations/{id}",
	request: {
		params: conversationIdParam
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(GetConversationResponseSchema, "Conversation details"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(ChatErrorResponseSchema, "Conversation not found"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ChatErrorResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Get conversation by ID",
	tags
});
export type GetConversationRoute = typeof getConversationRoute;

export const deleteConversationRoute = createRoute({
	description: "Delete a conversation and all of its messages",
	method: "delete",
	middleware: [authenticated],
	path: "/conversations/{id}",
	request: {
		params: conversationIdParam
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(DeleteConversationResponseSchema, "Conversation deleted"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(ChatErrorResponseSchema, "Conversation not found"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ChatErrorResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Delete conversation",
	tags
});

export type DeleteConversationRoute = typeof deleteConversationRoute;

export const updateConversationRoute = createRoute({
	description: "Update conversation by ID",
	method: "put",
	middleware: [authenticated],
	path: "/conversations/{id}",
	request: {
		body: jsonBody(UpdateConversationRequestSchema, "Conversation update data"),
		params: conversationIdParam
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(UpdateConversationResponseSchema, "Conversation updated"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(ChatErrorResponseSchema, "Conversation not found"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ChatErrorResponseSchema, "Unauthorized"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(ChatBadRequestResponseSchema, "Invalid input")
	},
	security: [{ CookieAuth: [] }],
	summary: "Update conversation",
	tags
});

export type UpdateConversationRoute = typeof updateConversationRoute;
