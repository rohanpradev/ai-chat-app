import {
	ConversationBadRequestResponseSchema,
	ConversationErrorResponseSchema,
	CreateConversationRequestSchema,
	CreateConversationResponseSchema,
	GetConversationResponseSchema,
	GetConversationsResponseSchema,
	UpdateConversationRequestSchema,
	UpdateConversationResponseSchema
} from "@chat-app/shared";
import { createRoute, z } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { authMiddleware } from "@/middlewares/auth-middleware";

const tags = ["Conversations"];

export const createConversationRoute = createRoute({
	description: "Create a new conversation",
	method: "post",
	middleware: [authMiddleware],
	path: "/conversations",
	request: {
		body: jsonContent(CreateConversationRequestSchema, "Conversation creation data")
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(CreateConversationResponseSchema, "Conversation created"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ConversationErrorResponseSchema, "Unauthorized"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(ConversationBadRequestResponseSchema, "Invalid input")
	},
	summary: "Create new conversation",
	tags
});

export const getConversationsRoute = createRoute({
	description: "Get all conversations for authenticated user",
	method: "get",
	middleware: [authMiddleware],
	path: "/conversations",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(GetConversationsResponseSchema, "List of conversations"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ConversationErrorResponseSchema, "Unauthorized")
	},
	summary: "Get user conversations",
	tags
});

export const getConversationRoute = createRoute({
	description: "Get specific conversation by ID",
	method: "get",
	middleware: [authMiddleware],
	path: "/conversations/{id}",
	request: {
		params: z.object({
			id: z.string().describe("Conversation ID")
		})
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(GetConversationResponseSchema, "Conversation details"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(ConversationErrorResponseSchema, "Conversation not found"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ConversationErrorResponseSchema, "Unauthorized")
	},
	summary: "Get conversation by ID",
	tags
});

export const updateConversationRoute = createRoute({
	description: "Update conversation by ID",
	method: "put",
	middleware: [authMiddleware],
	path: "/conversations/{id}",
	request: {
		body: jsonContent(UpdateConversationRequestSchema, "Conversation update data"),
		params: z.object({
			id: z.string().describe("Conversation ID")
		})
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(UpdateConversationResponseSchema, "Conversation updated"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(ConversationErrorResponseSchema, "Conversation not found"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(ConversationErrorResponseSchema, "Unauthorized"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(ConversationBadRequestResponseSchema, "Invalid input")
	},
	summary: "Update conversation",
	tags
});
