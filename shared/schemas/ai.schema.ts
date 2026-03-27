import { z } from "@hono/zod-openapi";
import { agentModeIds } from "@chat-app/shared/agents";
import { ModelsArraySchema } from "@chat-app/shared/schemas/common.schema";
import { UIMessagesArraySchema } from "@chat-app/shared/schemas/ui-message.schema";
import { enabledRequestToolIds } from "@chat-app/shared/tools";

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
    agentMode: z
      .enum(agentModeIds)
      .optional()
      .describe("Agent mode to use for this request"),
    // Accept multiple aliases from different clients/transports
    chatId: z.string().optional().describe("Chat ID for persistence"),
    conversationId: z
      .string()
      .optional()
      .describe("Alias for chatId used by older clients"),
    id: z
      .string()
      .optional()
      .describe("Alias for chatId used by default useChat transport"),
    // Prefer strong typing for messages
    messages: UIMessagesArraySchema.min(1, {
      error: "No messages provided",
    }).describe("Array of chat messages"),
    model: z.string().min(1).optional().describe("AI model to use"),
    tools: z
      .array(z.enum(enabledRequestToolIds))
      .optional()
      .describe("Approved server-side tools to make available"),
  })
  // Allow unknown props to safely ignore future additions from clients
  .loose();

export const AvailableModelsResponseSchema = z
  .object({
    data: ModelsArraySchema,
    message: z.string().describe("Success message"),
  })
  .openapi({
    description: "Available AI models for chat generation",
    title: "AvailableModelsResponse",
  });

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type AvailableModelsResponse = z.infer<
  typeof AvailableModelsResponseSchema
>;
