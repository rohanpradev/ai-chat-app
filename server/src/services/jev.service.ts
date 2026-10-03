import { JEV_MODEL_ID, type JevRequest, JevResponseSchema } from "@chat-app/shared";
import {
	APICallError,
	createGateway,
	type Experimental_EvaluationModel,
	type Experimental_EvaluationQuestion,
	experimental_evaluate as evaluate
} from "ai";
import { z } from "zod";
import type { reserveUsage, settleUsage } from "@/services/usage.service";

export class JevServiceError extends Error {
	readonly status: 408 | 429 | 502 | 503 | 504;
	constructor(message: string, status: 408 | 429 | 502 | 503 | 504) {
		super(message);
		this.status = status;
	}
}

export function createJevService(options: {
	apiKey?: string;
	model?: Experimental_EvaluationModel;
	reserveUsage: typeof reserveUsage;
	settleUsage: typeof settleUsage;
}) {
	return {
		async evaluate(request: JevRequest, userId: string, signal?: AbortSignal) {
			if (!options.apiKey) throw new JevServiceError("Add AI_GATEWAY_API_KEY on the server to connect Jev.", 503);
			if (signal?.aborted) throw new JevServiceError("Evaluation cancelled.", 408);
			const questions: Record<string, Experimental_EvaluationQuestion> = Object.fromEntries(
				request.questions.map(({ id, ...question }) => [id, question])
			);
			const state =
				request.stateFormat === "json"
					? z.union([z.record(z.string(), z.json()), z.array(z.json())]).parse(JSON.parse(request.state))
					: request.state;
			const estimatedTokens = Math.max(1, Math.ceil(JSON.stringify({ questions, state }).length / 4));
			const reservation = await options.reserveUsage({
				category: "jev-evaluation",
				estimatedTokens,
				model: JEV_MODEL_ID,
				scope: "ai",
				userId
			});
			const started = performance.now();
			const timeout = AbortSignal.timeout(20000);
			let providerCompleted = false;
			try {
				const result = await evaluate({
					abortSignal: signal ? AbortSignal.any([signal, timeout]) : timeout,
					maxRetries: 0,
					model: options.model ?? createGateway({ apiKey: options.apiKey }).evaluationModel(JEV_MODEL_ID),

					questions,
					state
				});
				providerCompleted = true;
				await options.settleUsage(reservation, {
					inputTokens: result.usage.inputTokens,
					outputTokens: result.usage.outputTokens,
					totalTokens: result.usage.totalTokens ?? estimatedTokens
				});
				const confidence = z
					.record(z.string(), z.number().min(0).max(1))
					.safeParse(result.providerMetadata?.typesafe?.confidence);
				return JevResponseSchema.parse({
					answers: Object.fromEntries(
						Object.entries(result.answers).map(([id, answer]) => [
							id,
							{
								...answer,
								...(answer.type !== "boolean" && confidence.success && confidence.data[id] !== undefined
									? { confidence: confidence.data[id] }
									: {})
							}
						])
					),
					durationMs: Math.round(performance.now() - started),
					model: result.response.modelId,
					usage: result.usage
				});
			} catch (error) {
				// Keep consumed or unknown usage charged when the provider may have executed the request.
				const status = APICallError.isInstance(error) ? error.statusCode : undefined;
				if (!providerCompleted)
					await options.settleUsage(
						reservation,
						status && [400, 401, 403, 422, 429].includes(status) ? { status: "failed" } : { totalTokens: estimatedTokens }
					);
				if (signal?.aborted) throw new JevServiceError("Evaluation cancelled.", 408);
				if (timeout.aborted) throw new JevServiceError("Jev took too long to respond. Try again.", 504);
				if (status === 401 || status === 403)
					throw new JevServiceError(
						"Jev could not authenticate. Ask an administrator to check the AI Gateway connection.",
						503
					);
				if (status === 429) throw new JevServiceError("AI Gateway is at its limit. Please try again later.", 429);
				throw new JevServiceError("Jev could not complete this evaluation. Check your questions and try again.", 502);
			}
		}
	};
}
