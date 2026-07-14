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
		requestedModel: z.string().optional(),
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

type PersistedMessageCandidate = {
	id?: unknown;
	metadata?: unknown;
	parts?: unknown;
	role?: unknown;
};

const uiMessageRoles = ["assistant", "system", "user"] as const satisfies readonly MyUIMessage["role"][];

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const normalizePersistedRole = (role: unknown): MyUIMessage["role"] =>
	typeof role === "string" && uiMessageRoles.includes(role as MyUIMessage["role"])
		? (role as MyUIMessage["role"])
		: "user";

const normalizePersistedParts = (parts: unknown): unknown[] =>
	Array.isArray(parts)
		? parts.map((part) => {
				if (typeof part === "string") {
					return { text: part, type: "text" };
				}

				return part;
			})
		: [];

const extractTextParts = (parts: unknown[]) =>
	parts.flatMap((part) => {
		if (typeof part === "string") {
			return part.trim() ? [{ text: part, type: "text" as const }] : [];
		}

		if (isRecord(part) && part.type === "text" && typeof part.text === "string" && part.text.trim()) {
			return [{ text: part.text, type: "text" as const }];
		}

		return [];
	});

const normalizePersistedMessage = (message: unknown, index: number) => {
	const candidate: PersistedMessageCandidate = isRecord(message) ? message : {};
	const parts = normalizePersistedParts(candidate.parts);

	return {
		id: typeof candidate.id === "string" && candidate.id ? candidate.id : `msg-${index}`,
		...(candidate.metadata === undefined ? {} : { metadata: candidate.metadata }),
		parts,
		role: normalizePersistedRole(candidate.role),
	};
};

export const coerceCompatibleMyUIMessages = async (messages: unknown): Promise<MyUIMessage[]> => {
	const normalizedMessages = Array.isArray(messages) ? messages.map(normalizePersistedMessage) : [];
	const validation = await safeValidateMyUIMessages(normalizedMessages);

	if (validation.success) {
		return validation.data;
	}

	const compatibleMessages: MyUIMessage[] = [];

	for (const [index, message] of normalizedMessages.entries()) {
		const singleMessageValidation = await safeValidateMyUIMessages([message]);
		if (singleMessageValidation.success) {
			compatibleMessages.push(...singleMessageValidation.data);
			continue;
		}

		const withoutMetadata = { ...message, metadata: undefined };
		const withoutMetadataValidation = await safeValidateMyUIMessages([withoutMetadata]);
		if (withoutMetadataValidation.success) {
			compatibleMessages.push(...withoutMetadataValidation.data);
			continue;
		}

		const textParts = extractTextParts(message.parts);
		if (textParts.length === 0) {
			continue;
		}

		const textOnlyMessage = {
			id: message.id || `msg-${index}`,
			parts: textParts,
			role: message.role,
		};
		const textOnlyValidation = await safeValidateMyUIMessages([textOnlyMessage]);
		if (textOnlyValidation.success) {
			compatibleMessages.push(...textOnlyValidation.data);
		}
	}

	return compatibleMessages;
};
