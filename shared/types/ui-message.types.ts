import { type InferUITool, type InferUITools, safeValidateUIMessages, type UIMessage, validateUIMessages } from "ai";
import { z } from "zod";
import { uiMessageTools } from "../tools";

export { uiMessageTools as tools } from "../tools";

// Metadata schema
const metadataSchema = z
	.object({
		conversationId: z.string().optional(),
		createdAt: z.iso.datetime().optional(),
		totalTokens: z.number().optional(),
	})
	.optional();

export type MyMetadata = z.infer<typeof metadataSchema>;
export type MyTools = InferUITools<typeof uiMessageTools>;
export type SerperUITool = InferUITool<(typeof uiMessageTools)["serper"]>;

export type MyUIMessage = UIMessage<MyMetadata, never, MyTools>;
export const validateMyUIMessages = (messages: unknown) =>
	validateUIMessages<MyUIMessage>({
		messages,
		metadataSchema,
		tools: uiMessageTools,
	});

export const safeValidateMyUIMessages = (messages: unknown) =>
	safeValidateUIMessages<MyUIMessage>({
		messages,
		metadataSchema,
		tools: uiMessageTools,
	});
