import { z } from "@hono/zod-openapi";
import { CommonBadRequestResponseSchema, CommonErrorResponseSchema } from "./common.schema";

export const ConversationSummarySchema = z.object({
	createdAt: z.string().describe("Creation timestamp"),
	id: z.string().describe("Unique Conversation identifier"),
	title: z.string().nullable().describe("Conversation title"),
	updatedAt: z.string().nullable().describe("Last update timestamp"),
}).openapi({
	description: "Conversation summary information",
	title: "ConversationSummary",
});

const MessageSchema = z.object({
	id: z.string(),
	parts: z.array(z.string()),
	role: z.enum(["user", "assistant", "system"]),
}).openapi({
	description: "Chat message",
	title: "Message",
});

export const ConversationDetailSchema = ConversationSummarySchema.extend({
	messages: z.array(MessageSchema).describe("Conversation messages"),
}).openapi({
	description: "Detailed conversation with messages",
	title: "ConversationDetail",
});

export const GetConversationsResponseSchema = z.object({
	data: z.array(ConversationSummarySchema),
	message: z.string().describe("Success message"),
}).openapi({
	description: "List of conversations response",
	title: "GetConversationsResponse",
});

export const GetConversationResponseSchema = z.object({
	data: ConversationDetailSchema.nullable(),
	message: z.string().describe("Success message"),
}).openapi({
	description: "Single conversation response",
	title: "GetConversationResponse",
});

export const CreateConversationRequestSchema = z.object({
	title: z.string().optional().describe("Optional conversation title"),
}).openapi({
	description: "Create conversation request",
	title: "CreateConversationRequest",
});

export const CreateConversationResponseSchema = z.object({
	data: ConversationSummarySchema,
	message: z.string().describe("Success message"),
}).openapi({
	description: "Create conversation response",
	title: "CreateConversationResponse",
});

export const UpdateConversationRequestSchema = z.object({
	title: z.string().describe("Updated conversation title"),
}).openapi({
	description: "Update conversation request",
	title: "UpdateConversationRequest",
});

export const UpdateConversationResponseSchema = z.object({
	data: ConversationSummarySchema,
	message: z.string().describe("Success message"),
}).openapi({
	description: "Update conversation response",
	title: "UpdateConversationResponse",
});

export const ChatErrorResponseSchema = CommonErrorResponseSchema;
export const ChatBadRequestResponseSchema = CommonBadRequestResponseSchema;
export const ConversationErrorResponseSchema = ChatErrorResponseSchema;
export const ConversationBadRequestResponseSchema = ChatBadRequestResponseSchema;

export type ConversationSummary = z.infer<typeof ConversationSummarySchema>;
export type ConversationDetail = z.infer<typeof ConversationDetailSchema>;
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;
export type CreateConversationResponse = z.infer<typeof CreateConversationResponseSchema>;
export type GetConversationsResponse = z.infer<typeof GetConversationsResponseSchema>;
export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;
export type UpdateConversationRequest = z.infer<typeof UpdateConversationRequestSchema>;
export type UpdateConversationResponse = z.infer<typeof UpdateConversationResponseSchema>;
export type ChatErrorResponse = z.infer<typeof ChatErrorResponseSchema>;
export type ChatBadRequestResponse = z.infer<typeof ChatBadRequestResponseSchema>;
