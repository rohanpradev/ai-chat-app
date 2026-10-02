import { z } from "@hono/zod-openapi";

export const JEV_MODEL_ID = "typesafe-ai/jev";
const identifier = z
	.string()
	.regex(/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/, "Use letters, numbers and underscores, starting with a letter.")
	.refine((value) => !["constructor", "prototype"].includes(value), "Reserved name.");
const description = z.string().trim().min(1).max(2000);
const base = { id: identifier, instructions: description };
export const JevQuestionSchema = z.discriminatedUnion("type", [
	z.object({
		...base,
		criteria: z
			.record(identifier, description)
			.refine((value) => Object.keys(value).length >= 2 && Object.keys(value).length <= 255, "Provide 2–255 options."),
		type: z.literal("choice"),
	}),
	z.object({ ...base, criteria: z.array(description).min(2).max(10), type: z.literal("score") }),
	z.object({
		...base,
		criteria: z.object({ false: description, true: description }).optional(),
		type: z.literal("boolean"),
	}),
]);
export const JevRequestSchema = z
	.object({
		questions: z.array(JevQuestionSchema).min(1).max(16),
		state: z.string().trim().min(1).max(32000),
		stateFormat: z.enum(["text", "json"]),
	})
	.superRefine((value, ctx) => {
		if (new Set(value.questions.map((question) => question.id)).size !== value.questions.length)
			ctx.addIssue({ code: "custom", message: "Question names must be unique.", path: ["questions"] });
		if (JSON.stringify(value).length > 64000)
			ctx.addIssue({ code: "custom", message: "Keep the complete evaluation under 64,000 characters." });
		if (value.stateFormat === "json") {
			try {
				const parsed: unknown = JSON.parse(value.state);
				if (parsed === null || typeof parsed !== "object") throw new Error("Invalid state");
			} catch {
				ctx.addIssue({ code: "custom", message: "Enter a valid JSON object or array.", path: ["state"] });
			}
		}
	});
const probability = z.number().min(0).max(1);
const distribution = z.record(z.string(), probability).optional();
export const JevAnswerSchema = z.discriminatedUnion("type", [
	z.object({
		choice: z.string(),
		confidence: probability.optional(),
		probabilities: distribution,
		type: z.literal("choice"),
	}),
	z.object({
		confidence: probability.optional(),
		probabilities: distribution,
		score: z.number(),
		type: z.literal("score"),
	}),
	z.object({ probability, type: z.literal("boolean") }),
]);
export const JevResponseSchema = z.object({
	answers: z.record(z.string(), JevAnswerSchema),
	durationMs: z.number().nonnegative(),
	model: z.string(),
	usage: z.object({
		inputTokens: z.number().nonnegative().optional(),
		outputTokens: z.number().nonnegative().optional(),
		totalTokens: z.number().nonnegative().optional(),
	}),
});
export const JevStatusSchema = z.object({ configured: z.boolean(), model: z.literal(JEV_MODEL_ID) });
export type JevRequest = z.infer<typeof JevRequestSchema>;
export type JevQuestion = z.infer<typeof JevQuestionSchema>;
export type JevResponse = z.infer<typeof JevResponseSchema>;
export type JevStatus = z.infer<typeof JevStatusSchema>;
