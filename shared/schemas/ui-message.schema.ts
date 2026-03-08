import { z } from "@hono/zod-openapi";

// Keep the OpenAPI schema permissive and delegate authoritative validation to
// AI SDK's validateUIMessages/safeValidateUIMessages. This avoids drifting from
// the SDK's evolving UI message protocol.
const UIMessagePartSchema = z.looseObject({
	type: z.string(),
});

export const UIMessageSchema = z.object({
	id: z.string(),
	metadata: z.unknown().optional(),
	parts: z.array(UIMessagePartSchema).min(1),
	role: z.enum(["system", "user", "assistant"]),
});

export const UIMessagesArraySchema = z.array(UIMessageSchema);
