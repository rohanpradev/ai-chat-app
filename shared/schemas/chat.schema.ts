import { z } from "@hono/zod-openapi";
import { CommonBadRequestResponseSchema, CommonErrorResponseSchema } from "./common.schema";

export const ChatDataSchema = z.object({
	createdAt: z.string().describe("Creation timestamp"),
	id: z.string().describe("Unique Chat identifier"),
	messages: z.array(z.any()).optional().describe("Chat messages"),
	title: z.string().nullable().describe("Chat title"),
	updatedAt: z.string().nullable().describe("Last update timestamp"),
});

export const UpsertChatRequestSchema = z.object({
	chatId: z.string().describe("Unique Chat identifier"),
	messages: z.array(z.any()).describe("Updated messages array"),
	title: z.string().describe("Updated Chat title"),
});

export const UpsertChatResponseSchema = z.object({
	data: z.object({ id: z.string().describe("Unique Chat identifier") }),
	message: z.string().describe("Success message"),
});

export const GetChatsResponseSchema = z.object({
	data: z.array(ChatDataSchema),
	message: z.string().describe("Success message"),
});

export const GetChatResponseSchema = z.object({
	data: ChatDataSchema.nullable(),
	message: z.string().describe("Success message"),
});

export const GetChatRequestSchema = z.object({
	chatId: z.string().describe("Unique Chat identifier"),
});

export const CreateConversationRequestSchema = z.object({
	title: z.string().optional().describe("Optional conversation title"),
});

export const UpdateConversationResponseSchema = z.object({
	message: z.string().describe("Success message"),
	success: z.boolean().describe("Operation success status"),
});

export const ChatErrorResponseSchema = CommonErrorResponseSchema;
export const ChatBadRequestResponseSchema = CommonBadRequestResponseSchema;

// Aliases for backward compatibility with server
export const GetConversationsResponseSchema = GetChatsResponseSchema;
export const CreateConversationResponseSchema = UpsertChatResponseSchema;
export const GetConversationResponseSchema = GetChatResponseSchema;
export const UpdateConversationRequestSchema = UpsertChatRequestSchema;
export const ConversationErrorResponseSchema = ChatErrorResponseSchema;
export const ConversationBadRequestResponseSchema = ChatBadRequestResponseSchema;

export type Chat = z.infer<typeof ChatDataSchema>;
export type UpsertChatRequest = z.infer<typeof UpsertChatRequestSchema>;
export type UpsertChatResponse = z.infer<typeof UpsertChatResponseSchema>;

// Aliases for backward compatibility
export type Conversation = Chat;
export type CreateConversationResponse = UpsertChatResponse;
export type CreateConversationRequest = z.infer<typeof CreateConversationRequestSchema>;
export type GetConversationsResponse = z.infer<typeof GetConversationsResponseSchema>;
export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;
export type UpdateConversationRequest = z.infer<typeof UpdateConversationRequestSchema>;
export type UpdateConversationResponse = z.infer<typeof UpdateConversationResponseSchema>;
