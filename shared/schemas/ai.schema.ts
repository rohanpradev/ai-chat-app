import { agentModeIds } from "@chat-app/shared/agents";
import { providers } from "@chat-app/shared/models";
import { ModelsArraySchema } from "@chat-app/shared/schemas/common.schema";
import { UIMessageSchema, UIMessagesArraySchema } from "@chat-app/shared/schemas/ui-message.schema";
import { enabledRequestToolIds } from "@chat-app/shared/tool-ids";
import { z } from "@hono/zod-openapi";

export const AIStreamResponseHeaders = {
	"Cache-Control": {
		schema: {
			example: "no-cache, no-transform",
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
	"X-Accel-Buffering": {
		schema: {
			example: "no",
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
		agentMode: z.enum(agentModeIds).optional().describe("Agent mode to use for this request"),
		// Accept multiple aliases from different clients/transports
		chatId: z.string().optional().describe("Chat ID for persistence"),
		conversationId: z.string().optional().describe("Alias for chatId used by older clients"),
		id: z.string().optional().describe("Alias for chatId used by default useChat transport"),
		message: UIMessageSchema.optional().describe("Latest chat message for persisted conversations"),
		messageId: z.string().optional().describe("Message ID used by regenerate requests"),
		messages: UIMessagesArraySchema.min(1, {
			error: "No messages provided",
		})
			.optional()
			.describe("Full chat message history"),
		model: z.string().min(1).optional().describe("AI model to use"),
		tools: z.array(z.enum(enabledRequestToolIds)).optional().describe("Approved server-side tools to make available"),
		trigger: z.enum(["submit-message", "regenerate-message"]).optional().describe("AI SDK transport trigger"),
	})
	// Allow unknown props to safely ignore future additions from clients
	.loose()
	.refine((request) => Boolean(request.message || request.messages?.length), {
		error: "No messages provided",
	});

export const AvailableModelsResponseSchema = z
	.object({
		data: ModelsArraySchema,
		message: z.string().describe("Success message"),
	})
	.openapi({
		description: "Available AI models for chat generation",
		title: "AvailableModelsResponse",
	});

const tokenUsageSchema = z
	.object({
		inputTokens: z.number().int().nonnegative().describe("Input tokens billed or estimated by the model provider"),
		outputTokens: z.number().int().nonnegative().describe("Output tokens billed or estimated by the model provider"),
		totalTokens: z.number().int().nonnegative().describe("Total tokens for the model call"),
	})
	.openapi({
		description: "AI SDK token usage summary",
		title: "AITokenUsage",
	});

export const AIGenerationMetadataSchema = z
	.object({
		finishReason: z.string().describe("AI SDK finish reason"),
		model: z.string().describe("Resolved model id used for generation"),
		provider: z.enum(providers).describe("Model provider used for generation"),
		usage: tokenUsageSchema,
	})
	.openapi({
		description: "Model, provider, finish reason, and usage metadata",
		title: "AIGenerationMetadata",
	});

const aiPlanStepSchema = z.object({
	action: z.string().describe("Concrete action to take"),
	expectedOutput: z.string().describe("Expected artifact or result from the step"),
	title: z.string().describe("Short step title"),
});

const aiPlanRiskSchema = z.object({
	mitigation: z.string().describe("How to reduce or monitor the risk"),
	risk: z.string().describe("Risk, ambiguity, or likely failure mode"),
	severity: z.enum(["low", "medium", "high"]).describe("Risk severity"),
});

export const AIPlanOutputSchema = z
	.object({
		complexity: z.enum(["low", "medium", "high"]).describe("Estimated task complexity"),
		evaluationChecklist: z
			.array(z.string())
			.min(1)
			.max(8)
			.describe("Checks that should pass before considering the result done"),
		followUpQuestions: z.array(z.string()).max(5).describe("Clarifying questions that would materially improve output"),
		intent: z.string().describe("User intent in one sentence"),
		needsFreshness: z.boolean().describe("Whether current/live information is important"),
		recommendedAgentMode: z.enum(agentModeIds).describe("Best app agent mode for the task"),
		recommendedModel: z.string().describe("Recommended model id for this task"),
		recommendedTools: z
			.array(z.enum(enabledRequestToolIds))
			.max(enabledRequestToolIds.length)
			.describe("Approved server-side tools that would help"),
		risks: z.array(aiPlanRiskSchema).max(6).describe("Known risks and mitigations"),
		steps: z.array(aiPlanStepSchema).min(1).max(8).describe("Execution plan"),
		title: z.string().describe("Short plan title"),
	})
	.openapi({
		description: "Schema-validated AI task plan generated with AI SDK structured output",
		title: "AIPlanOutput",
	});

export const AIPlanRequestSchema = z
	.object({
		context: z.string().max(12_000).optional().describe("Optional background context, constraints, or source notes"),
		goals: z.array(z.string().min(1).max(500)).max(8).optional().describe("Optional target outcomes"),
		model: z.string().min(1).optional().describe("Optional model id to use"),
		prompt: z.string().min(1).max(8_000).describe("User request to analyze and plan"),
	})
	.openapi({
		description: "Structured planning request",
		title: "AIPlanRequest",
	});

export const AIPlanResponseSchema = z
	.object({
		data: AIPlanOutputSchema,
		message: z.string().describe("Success message"),
		metadata: AIGenerationMetadataSchema,
	})
	.openapi({
		description: "Structured planning response",
		title: "AIPlanResponse",
	});

const evaluationIssueSchema = z.object({
	category: z
		.enum(["accuracy", "grounding", "safety", "completeness", "instruction_following", "style"])
		.describe("Issue category"),
	description: z.string().describe("Issue description"),
	severity: z.enum(["low", "medium", "high"]).describe("Issue severity"),
	suggestion: z.string().describe("Concrete improvement"),
});

export const AIEvaluationOutputSchema = z
	.object({
		finalRecommendation: z.string().describe("What to do next with the evaluated output"),
		grounded: z.boolean().describe("Whether the output is grounded in supplied context or reference"),
		hallucinationRisk: z.enum(["low", "medium", "high"]).describe("Risk that the output contains unsupported claims"),
		issues: z.array(evaluationIssueSchema).max(8).describe("Specific issues found"),
		label: z.enum(["pass", "needs_review", "fail"]).describe("Overall judgment label"),
		score: z.number().min(0).max(1).describe("Overall quality score from 0 to 1"),
		strengths: z.array(z.string()).max(6).describe("What the output did well"),
	})
	.openapi({
		description: "Schema-validated LLM-as-judge evaluation result",
		title: "AIEvaluationOutput",
	});

export const AIEvaluationRequestSchema = z
	.object({
		context: z.array(z.string().max(6_000)).max(10).optional().describe("Retrieved context, source chunks, or evidence"),
		input: z.string().min(1).max(10_000).describe("Original user prompt or task"),
		model: z.string().min(1).optional().describe("Optional judge model id to use"),
		output: z.string().min(1).max(20_000).describe("Assistant output to evaluate"),
		reference: z.string().max(12_000).optional().describe("Optional gold answer, policy, or expected output"),
		rubric: z.array(z.string().min(1).max(1_000)).max(10).optional().describe("Optional evaluation criteria"),
	})
	.openapi({
		description: "LLM-as-judge evaluation request",
		title: "AIEvaluationRequest",
	});

export const AIEvaluationResponseSchema = z
	.object({
		data: AIEvaluationOutputSchema,
		message: z.string().describe("Success message"),
		metadata: AIGenerationMetadataSchema,
	})
	.openapi({
		description: "LLM-as-judge evaluation response",
		title: "AIEvaluationResponse",
	});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type AvailableModelsResponse = z.infer<typeof AvailableModelsResponseSchema>;
export type AIPlanOutput = z.infer<typeof AIPlanOutputSchema>;
export type AIPlanRequest = z.infer<typeof AIPlanRequestSchema>;
export type AIPlanResponse = z.infer<typeof AIPlanResponseSchema>;
export type AIEvaluationOutput = z.infer<typeof AIEvaluationOutputSchema>;
export type AIEvaluationRequest = z.infer<typeof AIEvaluationRequestSchema>;
export type AIEvaluationResponse = z.infer<typeof AIEvaluationResponseSchema>;
