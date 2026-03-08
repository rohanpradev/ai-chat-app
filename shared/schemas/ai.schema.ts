import { z } from "@hono/zod-openapi";
import { modelIds } from "../models";
import { UIMessagesArraySchema } from "./ui-message.schema";

export const AIStreamResponseHeaders = {
	"Cache-Control": {
		schema: {
			example: "no-cache",
			type: "string",
		},
	},
	Connection: {
		schema: {
			example: "keep-alive",
			type: "string",
		},
	},
	"Content-Type": {
		schema: {
			example: "text/event-stream; charset=utf-8",
			type: "string",
		},
	},
	"Transfer-Encoding": {
		schema: {
			example: "chunked",
			type: "string",
		},
	},
	"x-vercel-ai-ui-message-stream": {
		schema: {
			example: "v1",
			type: "string",
		},
	},
} as const;

export const ChatRequestSchema = z
	.object({
		// Accept multiple aliases from different clients/transports
		chatId: z.string().optional().describe("Chat ID for persistence"),
		conversationId: z.string().optional().describe("Alias for chatId used by older clients"),
		id: z.string().optional().describe("Alias for chatId used by default useChat transport"),
		// Prefer strong typing for messages
		messages: UIMessagesArraySchema.min(1, {
			error: "No messages provided",
		}).describe("Array of chat messages"),
		model: z.enum(modelIds).optional().describe("AI model to use"),
		tools: z.array(z.string()).optional().describe("Available tools"),
		webSearch: z.boolean().optional().default(false).describe("Enable web search"),
	})
	// Allow unknown props to safely ignore future additions from clients
	.loose();
