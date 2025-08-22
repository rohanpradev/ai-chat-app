import { z } from "@hono/zod-openapi";
import type { UIMessage } from "ai";
import { UIMessagesArraySchema } from "./ui-message.schema";

export const AITextResponseSchema = z.object({
	conversationId: z.string().optional().describe("ID of the conversation"),
	messages: z.array(z.any()).describe("Array of chat messages including the AI response"),
	text: z.string().describe("The response by the model to the input prompt").openapi({
		description: "The detailed text the response of the model to the input.",
		example: "The response by the model to the input prompt",
		type: "string",
	}),
});

export const AIStreamResponseHeaders = {
	Connection: {
		schema: {
			example: "keep-alive",
			type: "string",
		},
	},
	"Content-Type": {
		schema: {
			example: "text/plain; charset=utf-8",
			type: "string",
		},
	},
	"Transfer-Encoding": {
		schema: {
			example: "chunked",
			type: "string",
		},
	},
} as const;

export interface MessageMetadata {
	createdAt?: Date | number | string;
	totalTokens?: number;
}

export type MyUIMessage = UIMessage<MessageMetadata>;

export const ToolCallSchema = z.object({
	args: z.any(),
	id: z.string(),
	name: z.string(),
});

export const ToolResultSchema = z.object({
	id: z.string(),
	name: z.string(),
	result: z.any(),
});

export const FileAttachmentSchema = z.object({
	content: z.string().optional(),
	id: z.string(),
	name: z.string(),
	size: z.number(),
	type: z.string(),
	url: z.string().optional(),
});

export const ChatRequestSchema = z
	.object({
		// Accept multiple aliases from different clients/transports
		chatId: z.string().optional().describe("Chat ID for persistence"),
		conversationId: z.string().optional().describe("Alias for chatId used by older clients"),
		id: z.string().optional().describe("Alias for chatId used by default useChat transport"),
		// Prefer strong typing for messages
		messages: UIMessagesArraySchema.describe("Array of chat messages"),
		model: z.string().optional().describe("AI model to use"),
		tools: z.array(z.string()).optional().describe("Available tools"),
		webSearch: z.boolean().optional().default(false).describe("Enable web search"),
	})
	// Allow unknown props to safely ignore future additions from clients
	.loose();
