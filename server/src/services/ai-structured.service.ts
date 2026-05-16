import {
	type AIEvaluationOutput,
	AIEvaluationOutputSchema,
	type AIEvaluationRequest,
	type AIPlanOutput,
	AIPlanOutputSchema,
	type AIPlanRequest,
	type AIProvider,
	agentModes,
	enabledRequestToolIds
} from "@chat-app/shared";
import { generateText, Output } from "ai";
import { isTelemetryEnabled } from "@/lib/instrumentation";
import { resolveModel, resolveModelSelection } from "@/utils/index";

interface StructuredGenerationMetadata {
	finishReason: string;
	model: string;
	provider: AIProvider;
	usage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
}

interface StructuredGenerationResult<TData> {
	data: TData;
	metadata: StructuredGenerationMetadata;
}

const tokenCount = (value: number | undefined) => (typeof value === "number" && Number.isFinite(value) ? value : 0);

const buildMetadata = ({
	finishReason,
	model,
	provider,
	usage
}: {
	finishReason: string;
	model: string;
	provider: AIProvider;
	usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}): StructuredGenerationMetadata => {
	const inputTokens = tokenCount(usage.inputTokens);
	const outputTokens = tokenCount(usage.outputTokens);

	return {
		finishReason,
		model,
		provider,
		usage: {
			inputTokens,
			outputTokens,
			totalTokens: tokenCount(usage.totalTokens) || inputTokens + outputTokens
		}
	};
};

const formatOptionalList = (label: string, values: string[] | undefined) =>
	values?.length ? `${label}:\n${values.map((value, index) => `${index + 1}. ${value}`).join("\n")}` : undefined;

const structuredTelemetry = ({
	functionId,
	model,
	provider,
	userId
}: {
	functionId: string;
	model: string;
	provider: AIProvider;
	userId: string;
}) =>
	isTelemetryEnabled
		? {
				functionId,
				metadata: {
					model,
					provider,
					tags: ["ai", "structured-output", functionId],
					userId
				}
			}
		: undefined;

export const generateStructuredPlan = async (
	request: AIPlanRequest,
	userId: string,
	abortSignal?: AbortSignal
): Promise<StructuredGenerationResult<AIPlanOutput>> => {
	const resolvedModel = await resolveModelSelection(request.model);
	const agentModeCatalog = agentModes.map((agentMode) => `${agentMode.id}: ${agentMode.description}`).join("\n");
	const prompt = [
		`User request:\n${request.prompt}`,
		request.context ? `Context:\n${request.context}` : undefined,
		formatOptionalList("Goals", request.goals),
		`Available agent modes:\n${agentModeCatalog}`,
		`Available approved tools:\n${enabledRequestToolIds.join(", ") || "none"}`,
		`Resolved model for this call: ${resolvedModel.id}`
	]
		.filter((section): section is string => Boolean(section))
		.join("\n\n");

	const result = await generateText({
		abortSignal,
		maxRetries: 1,
		model: resolveModel(resolvedModel.id),
		output: Output.object({
			description:
				"A concise execution plan for routing an AI task, selecting tools, identifying risks, and defining evaluation checks.",
			name: "AIWorkPlan",
			schema: AIPlanOutputSchema
		}),
		prompt,
		system: [
			"You are an AI work planner for a Bun and JavaScript AI platform.",
			"Return practical, schema-valid planning data only.",
			"Prefer the research agent and live web tool only when the task requires verification, freshness, or multi-step synthesis.",
			"Keep steps concrete enough that another agent or engineer can execute them."
		].join("\n"),
		telemetry: structuredTelemetry({
			functionId: "ai-structured-plan",
			model: resolvedModel.id,
			provider: resolvedModel.provider,
			userId
		}),
		temperature: 0.2
	});

	return {
		data: result.output,
		metadata: buildMetadata({
			finishReason: result.finishReason,
			model: resolvedModel.id,
			provider: resolvedModel.provider,
			usage: result.usage
		})
	};
};

export const evaluateAIOutput = async (
	request: AIEvaluationRequest,
	userId: string,
	abortSignal?: AbortSignal
): Promise<StructuredGenerationResult<AIEvaluationOutput>> => {
	const resolvedModel = await resolveModelSelection(request.model);
	const prompt = [
		`Original input:\n${request.input}`,
		`Assistant output to evaluate:\n${request.output}`,
		request.reference ? `Reference or expected output:\n${request.reference}` : undefined,
		formatOptionalList("Rubric", request.rubric),
		formatOptionalList("Context or evidence", request.context)
	]
		.filter((section): section is string => Boolean(section))
		.join("\n\n");

	const result = await generateText({
		abortSignal,
		maxRetries: 1,
		model: resolveModel(resolvedModel.id),
		output: Output.object({
			description:
				"A production LLM-as-judge result with a normalized score, review label, risks, strengths, and actionable fixes.",
			name: "AIEvaluation",
			schema: AIEvaluationOutputSchema
		}),
		prompt,
		system: [
			"You are an evaluator for a production AI application.",
			"Judge only the supplied output against the supplied input, context, reference, and rubric.",
			"Reward grounded, complete, safe, instruction-following answers.",
			"Penalize unsupported claims, missing caveats, unsafe guidance, and failure to answer.",
			"Use score 1 for excellent, 0.5 for mixed, and 0 for unusable or unsafe output."
		].join("\n"),
		telemetry: structuredTelemetry({
			functionId: "ai-evaluate-output",
			model: resolvedModel.id,
			provider: resolvedModel.provider,
			userId
		}),
		temperature: 0
	});

	return {
		data: result.output,
		metadata: buildMetadata({
			finishReason: result.finishReason,
			model: resolvedModel.id,
			provider: resolvedModel.provider,
			usage: result.usage
		})
	};
};
