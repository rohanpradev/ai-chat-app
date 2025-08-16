import { z } from "@hono/zod-openapi";
import type { UIMessage } from "ai";

export const AITextResponseSchema = z.object({
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

export const ChatRequestSchema = z.object({
	messages: z.array(z.any()).describe("Array of chat messages"),
	model: z.string().optional().describe("AI model to use for the response").openapi({
		description: "The AI model identifier",
		example: "gpt-5-mini",
	}),
	tools: z.array(z.string()).optional().describe("Available tools for the AI to use"),
	webSearch: z.boolean().optional().default(false).describe("Whether to enable web search").openapi({
		description: "Enable web search capabilities",
		example: false,
	}),
});
