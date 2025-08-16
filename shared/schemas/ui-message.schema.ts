import { z } from "@hono/zod-openapi";

const TextUIPartSchema = z.object({
	providerMetadata: z.record(z.string(), z.unknown()).optional(),
	state: z.enum(["streaming", "done"]).optional(),
	text: z.string(),
	type: z.literal("text"),
});

const FileUIPartSchema = z.object({
	filename: z.string().optional(),
	mediaType: z.string(),
	providerMetadata: z.record(z.string(), z.unknown()).optional(),
	type: z.literal("file"),
	url: z.url(),
});

const StepStartUIPartSchema = z.looseObject({
	type: z.literal("step-start"),
});

const ReasoningUIPartSchema = z.object({
	providerMetadata: z.record(z.string(), z.unknown()).optional(),
	state: z.enum(["streaming", "done"]).optional(),
	text: z.string(),
	type: z.literal("reasoning"),
});

const ToolUIPartSchema = z.object({
	callProviderMetadata: z.record(z.string(), z.unknown()).optional(),
	errorText: z.string().optional(),
	input: z.unknown().optional(),
	output: z.unknown().optional(),
	providerExecuted: z.boolean().optional(),
	state: z.enum(["input-streaming", "input-available", "output-available", "output-error"]).optional(),
	toolCallId: z.string(),
	type: z.string().regex(/^tool-.+/),
});

const GenericUIPartSchema = z.looseObject({
	type: z.string(),
});

const UIMessagePartSchema = z.union([
	TextUIPartSchema,
	FileUIPartSchema,
	StepStartUIPartSchema,
	ReasoningUIPartSchema,
	ToolUIPartSchema,
	GenericUIPartSchema,
]);

export const UIMessageSchema = z.object({
	id: z.string(),
	metadata: z.unknown().optional(),
	parts: z.array(UIMessagePartSchema),
	role: z.enum(["system", "user", "assistant"]),
});

export const UIMessageRequestSchema = z
	.object({
		messages: z.array(UIMessageSchema).describe("The messages to send to the AI model"),
	})
	.openapi({
		description: "Request object containing an array of UI messages",
		example: {
			messages: [
				{
					id: "msg_1",
					parts: [
						{
							state: "done",
							text: "Hello, how are you?",
							type: "text",
						},
					],
					role: "user",
				},
			],
		},
	});

export const UIMessagesArraySchema = z.array(UIMessageSchema);

export {
	FileUIPartSchema,
	GenericUIPartSchema,
	ReasoningUIPartSchema,
	StepStartUIPartSchema,
	TextUIPartSchema,
	ToolUIPartSchema,
	UIMessagePartSchema,
};
