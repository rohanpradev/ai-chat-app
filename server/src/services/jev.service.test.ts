import { describe, expect, it, mock } from "bun:test";
import { JevRequestSchema } from "@chat-app/shared";
import { APICallError } from "ai";
import { Experimental_EvaluationMockModelV4 as MockModel } from "ai/test";
import { createJevService } from "@/services/jev.service";

const request = {
	questions: [
		{
			criteria: { billing: "Payments", other: "Anything else" },
			id: "team",
			instructions: "Which team?",
			type: "choice"
		},
		{ criteria: ["Calm", "Upset", "Angry"], id: "tone", instructions: "How frustrated?", type: "score" },
		{ id: "urgent", instructions: "Is it urgent?", type: "boolean" }
	],
	state: '{"message":"I was charged twice. Please fix this today."}',
	stateFormat: "json"
} as const;
type ProviderResult = Awaited<ReturnType<MockModel["doEvaluate"]>>;
const providerResult: ProviderResult = {
	answers: {
		team: { choice: "billing", probabilities: { billing: 0.9, other: 0.1 }, type: "choice" },
		tone: { probabilities: { "0": 0.1, "1": 0.7, "2": 0.2 }, score: 1.1, type: "score" },
		urgent: { probability: 0.91, type: "boolean" }
	},
	providerMetadata: { typesafe: { confidence: { team: 0.8, tone: 0.7 } } },
	usage: { inputTokens: 200, outputTokens: 40 },
	warnings: []
};
const setup = (result = providerResult, apiKey = "test-key") => {
	const doEvaluate = mock<MockModel["doEvaluate"]>(async () => result);
	const reserveUsage = mock(async () => "reservation");
	const settleUsage = mock(async () => {});
	return {
		doEvaluate,
		reserveUsage,
		service: createJevService({
			apiKey,
			model: new MockModel({ doEvaluate, modelId: "typesafe-ai/jev" }),
			reserveUsage,
			settleUsage
		}),
		settleUsage
	};
};
describe("Jev evaluation through AI SDK", () => {
	it("bundles typed questions and JSON state, preserves confidence, and meters usage", async () => {
		const { service, doEvaluate, reserveUsage, settleUsage } = setup();
		const result = await service.evaluate(JevRequestSchema.parse(request), "user-1");
		expect(result.answers).toMatchObject({
			team: { choice: "billing", confidence: 0.8 },
			tone: { confidence: 0.7, score: 1.1 },
			urgent: { probability: 0.91 }
		});
		expect(result.answers.urgent).not.toHaveProperty("confidence");
		expect(result.durationMs).toBeGreaterThanOrEqual(0);
		expect(doEvaluate).toHaveBeenCalledTimes(1);
		expect(doEvaluate.mock.calls[0]?.[0]).toMatchObject({
			questions: { team: { type: "choice" }, tone: { type: "score" }, urgent: { type: "boolean" } },
			state: { message: "I was charged twice. Please fix this today." }
		});
		expect(reserveUsage).toHaveBeenCalledWith(
			expect.objectContaining({ category: "jev-evaluation", scope: "ai", userId: "user-1" })
		);
		expect(settleUsage).toHaveBeenCalledWith("reservation", { inputTokens: 200, outputTokens: 40, totalTokens: 240 });
	});
	it("keeps missing confidence unavailable", async () => {
		const { service } = setup({ ...providerResult, providerMetadata: undefined });
		expect((await service.evaluate(JevRequestSchema.parse(request), "user-1")).answers.team).not.toHaveProperty(
			"confidence"
		);
	});
	it("requires credentials before reserving quota or contacting the provider", async () => {
		const { service, doEvaluate, reserveUsage } = setup(undefined, "");
		await expect(service.evaluate(JevRequestSchema.parse(request), "user-1")).rejects.toMatchObject({ status: 503 });
		expect(doEvaluate).not.toHaveBeenCalled();
		expect(reserveUsage).not.toHaveBeenCalled();
	});
	it("rejects malformed questions and excessive input", () => {
		for (const invalid of [
			{ ...request, questions: [] },
			{ ...request, questions: [request.questions[0], request.questions[0]] },
			{ ...request, state: "x".repeat(32001) },
			{ ...request, state: "not json" },
			{ ...request, state: "null" },
			{ ...request, questions: [{ ...request.questions[1], criteria: ["one"] }] },
			{ ...request, questions: [{ ...request.questions[0], id: "__proto__" }] }
		])
			expect(JevRequestSchema.safeParse(invalid).success).toBe(false);
	});
	it("rejects answers outside the submitted options", async () => {
		const { service } = setup({
			...providerResult,
			answers: { ...providerResult.answers, team: { choice: "invented", type: "choice" } }
		});
		await expect(service.evaluate(JevRequestSchema.parse(request), "user-1")).rejects.toMatchObject({ status: 502 });
	});
	it("accepts rounded probability distributions", async () => {
		const { service } = setup({
			...providerResult,
			answers: {
				...providerResult.answers,
				team: { choice: "billing", probabilities: { billing: 0.9, other: 0.09 }, type: "choice" }
			},
			rounding: { probabilityDecimals: 2, scoreDecimals: 2 }
		});
		expect((await service.evaluate(JevRequestSchema.parse(request), "user-1")).answers.team).toMatchObject({
			probabilities: { billing: 0.9, other: 0.09 }
		});
	});
	it("sanitizes provider errors and releases rejected reservations", async () => {
		const { service, doEvaluate, settleUsage } = setup();
		doEvaluate.mockRejectedValueOnce(
			new APICallError({
				message: "private document and token",
				requestBodyValues: {},
				statusCode: 401,
				url: "https://example.com"
			})
		);
		await expect(service.evaluate(JevRequestSchema.parse(request), "user-1")).rejects.toMatchObject({
			message: "Jev could not authenticate. Ask an administrator to check the AI Gateway connection.",
			status: 503
		});
		expect(settleUsage).toHaveBeenCalledWith("reservation", { status: "failed" });
	});
	it("does not call the provider when quota is exhausted", async () => {
		const { service, reserveUsage, doEvaluate } = setup();
		reserveUsage.mockRejectedValueOnce(new Error("quota exceeded"));
		await expect(service.evaluate(JevRequestSchema.parse(request), "user-1")).rejects.toThrow("quota exceeded");
		expect(doEvaluate).not.toHaveBeenCalled();
	});
	it("honors cancellation before contacting the provider", async () => {
		const { service, doEvaluate } = setup();
		await expect(service.evaluate(JevRequestSchema.parse(request), "user-1", AbortSignal.abort())).rejects.toMatchObject({
			status: 408
		});
		expect(doEvaluate).not.toHaveBeenCalled();
	});
});
