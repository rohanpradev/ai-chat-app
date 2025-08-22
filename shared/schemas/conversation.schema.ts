import { z } from "@hono/zod-openapi";
import { CommonBadRequestResponseSchema, CommonErrorResponseSchema } from "./common.schema";

export const ConversationDataSchema = z.object({
	createdAt: z.string().describe("Creation timestamp"),
	id: z.string().describe("Unique conversation identifier"),
	messages: z.array(z.any()).optional().describe("Conversation messages"),
	title: z.string().nullable().describe("Conversation title"),
	updatedAt: z.string().nullable().describe("Last update timestamp"),
});

export const CreateConversationRequestSchema = z.object({
	title: z.string().optional().describe("Optional conversation title"),
});

export const UpdateConversationRequestSchema = z.object({
	messages: z.array(z.any()).describe("Updated messages array"),
	title: z.string().optional().describe("Updated conversation title"),
});

export const CreateConversationResponseSchema = z.object({
	data: ConversationDataSchema,
	message: z.string().describe("Success message"),
});

export const GetConversationsResponseSchema = z.object({
	data: z.array(ConversationDataSchema),
	message: z.string().describe("Success message"),
});

export const GetConversationResponseSchema = z.object({
	data: ConversationDataSchema,
	message: z.string().describe("Success message"),
});

export const UpdateConversationResponseSchema = z.object({
	message: z.string().describe("Success message"),
	success: z.boolean().describe("Operation success status"),
});

export const ConversationErrorResponseSchema = CommonErrorResponseSchema;
export const ConversationBadRequestResponseSchema = CommonBadRequestResponseSchema;

export type Conversation = z.infer<typeof ConversationDataSchema>;
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;
export type CreateConversationResponse = z.infer<typeof CreateConversationResponseSchema>;
