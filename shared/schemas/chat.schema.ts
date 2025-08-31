import { z } from "@hono/zod-openapi";
import { CommonBadRequestResponseSchema, CommonErrorResponseSchema } from "./common.schema";

export const ConversationSummarySchema = z.object({
	createdAt: z.string().describe("Creation timestamp"),
	id: z.string().describe("Unique Conversation identifier"),
	title: z.string().nullable().describe("Conversation title"),
	updatedAt: z.string().nullable().describe("Last update timestamp"),
});

const MessageSchema = z.object({
	id: z.string(),
	parts: z.array(z.string()),
	role: z.enum(["user", "assistant", "system"]),
});

export const ConversationDetailSchema = ConversationSummarySchema.extend({
	messages: z.array(MessageSchema).describe("Conversation messages"),
});

export const GetConversationsResponseSchema = z.object({
	data: z.array(ConversationSummarySchema),
	message: z.string().describe("Success message"),
});

export const GetConversationResponseSchema = z.object({
	data: ConversationDetailSchema.nullable(),
	message: z.string().describe("Success message"),
});

export const CreateConversationRequestSchema = z.object({
	title: z.string().optional().describe("Optional conversation title"),
});

export const CreateConversationResponseSchema = z.object({
	data: ConversationSummarySchema,
	message: z.string().describe("Success message"),
});

export const UpdateConversationRequestSchema = z.object({
	title: z.string().describe("Updated conversation title"),
});

export const UpdateConversationResponseSchema = z.object({
	data: ConversationSummarySchema,
	message: z.string().describe("Success message"),
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
