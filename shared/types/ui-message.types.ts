import { uiMessageTools } from "@chat-app/shared/tools";
import { type InferUITool, type InferUITools, safeValidateUIMessages, type UIMessage, validateUIMessages } from "ai";
import { z } from "zod";

export { uiMessageTools as tools } from "@chat-app/shared/tools";

const isoDatetimeSchema = z.string().datetime({ offset: true });

export const myUIMessageMetadataSchema = z
	.object({
		conversationId: z.string().optional(),
		createdAt: isoDatetimeSchema.optional(),
		finishReason: z.enum(["stop", "length", "content-filter", "tool-calls", "error", "other"]).optional(),
		model: z.string().optional(),
		totalTokens: z.number().optional(),
	})
	.optional();

export type MyMetadata = z.infer<typeof myUIMessageMetadataSchema>;
export type MyTools = InferUITools<typeof uiMessageTools>;
export type SerperUITool = InferUITool<(typeof uiMessageTools)["serper"]>;

export type MyUIMessage = UIMessage<MyMetadata, never, MyTools>;
export const validateMyUIMessages = (messages: unknown) =>
	validateUIMessages<MyUIMessage>({
		messages,
		metadataSchema: myUIMessageMetadataSchema,
		tools: uiMessageTools,
	});

export const safeValidateMyUIMessages = (messages: unknown) =>
	safeValidateUIMessages<MyUIMessage>({
		messages,
		metadataSchema: myUIMessageMetadataSchema,
		tools: uiMessageTools,
	});
