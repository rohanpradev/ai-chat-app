import { describe, expect, it, mock } from "bun:test";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";

const saveConversationMock = mock(async () => {});
const getAvailableChatModelsMock = mock(async () => [{ id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" }]);
const mockUsage = {
	inputTokens: {
		cacheRead: undefined,
		cacheWrite: undefined,
		noCache: 10,
		total: 10
	},
	outputTokens: { reasoning: undefined, text: 20, total: 20 }
};
const mockFinishReason = { raw: "stop", unified: "stop" } as const;
const mockPlanOutput = {
	complexity: "medium",
	evaluationChecklist: ["Response is grounded", "Tool use is justified"],
	followUpQuestions: ["What sources should be prioritized?"],
	intent: "Research and implement an AI feature",
	needsFreshness: true,
	recommendedAgentMode: "research",
	recommendedModel: "gpt-5-mini",
	recommendedTools: ["serper"],
	risks: [{ mitigation: "Verify with primary sources", risk: "Stale documentation", severity: "medium" }],
	steps: [{ action: "Review official SDK docs", expectedOutput: "Implementation notes", title: "Research" }],
	title: "AI feature plan"
};
const mockEvaluationOutput = {
	finalRecommendation: "Ship after adding one citation.",
	grounded: true,
	hallucinationRisk: "low",
	issues: [
		{
			category: "grounding",
			description: "One claim needs a source.",
			severity: "low",
			suggestion: "Attach the relevant documentation link."
		}
	],
	label: "pass",
	score: 0.86,
	strengths: ["Clear answer", "Actionable next step"]
};

mock.module("@/middlewares/auth-middleware", () => ({
	authMiddleware: mock(async (c, next) => {
		c.set("jwtPayload", { sub: { id: "test-user" } });
		await next();
	})
}));

mock.module("@/services/conversation.service", () => ({
	loadConversationMessages: mock(async () => []),
	mergeConversationMessages: <TMessage>(storedMessages: TMessage[], incomingMessages: TMessage[]) => [
		...storedMessages,
		...incomingMessages
	],
	saveConversation: saveConversationMock
}));

mock.module("@/services/model-catalog.service", () => ({
	getAvailableChatModels: getAvailableChatModelsMock
}));

mock.module("@/utils/index", () => ({
	resolveModel: () =>
		new MockLanguageModelV3({
			doGenerate: async (options) => ({
				content: [
					{
						text: JSON.stringify(
							options.responseFormat?.type === "json" && options.responseFormat.name === "AIEvaluation"
								? mockEvaluationOutput
								: mockPlanOutput
						),
						type: "text"
					}
				],
				finishReason: mockFinishReason,
				usage: mockUsage,
				warnings: []
			}),
			doStream: async () => ({
				stream: simulateReadableStream({
					chunks: [
						{ id: "text-1", type: "text-start" },
						{ delta: "Hello", id: "text-1", type: "text-delta" },
						{ delta: " from test", id: "text-1", type: "text-delta" },
						{ id: "text-1", type: "text-end" },
						{
							finishReason: { raw: undefined, unified: "stop" },
							logprobs: undefined,
							type: "finish",
							usage: {
								inputTokens: {
									cacheRead: undefined,
									cacheWrite: undefined,
									noCache: 2,
									total: 2
								},
								outputTokens: { reasoning: undefined, text: 3, total: 3 }
							}
						}
					]
				})
			})
		}),
	resolveModelSelection: async (model = "gpt-5-mini") => ({
		id: model,
		name: "Mock Model",
		provider: "openai"
	}),
	transformPrompt: async () => [{ content: "test", role: "user" }]
}));

describe("AI Routes", () => {
	it("lists available models for the client selector", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const response = await app.request("/ai/models", {
			method: "GET"
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.data).toEqual([{ id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" }]);
	});

	it("generates a structured AI work plan", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const response = await app.request("/ai/plan", {
			body: JSON.stringify({
				context: "Use official docs and keep the app stable.",
				goals: ["Add only useful AI platform features"],
				prompt: "Add modern AI SDK concepts to this Bun app."
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.data.recommendedAgentMode).toBe("research");
		expect(payload.data.recommendedTools).toEqual(["serper"]);
		expect(payload.metadata.model).toBe("gpt-5-mini");
		expect(payload.metadata.usage.totalTokens).toBe(30);
	});

	it("evaluates an AI output with a structured judge result", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const response = await app.request("/ai/evaluate", {
			body: JSON.stringify({
				context: ["Official SDK docs say structured output is schema-validated."],
				input: "Explain structured outputs.",
				output: "Structured outputs validate model JSON against a schema.",
				rubric: ["Prefer grounded, complete answers."]
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.data.label).toBe("pass");
		expect(payload.data.score).toBe(0.86);
		expect(payload.data.hallucinationRisk).toBe("low");
		expect(payload.metadata.usage.totalTokens).toBe(30);
	});

	it("streams deterministic output using ai/test mock model", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const response = await app.request("/ai/text-stream", {
			body: JSON.stringify({
				messages: [{ id: "1", parts: [{ text: "test", type: "text" }], role: "user" }]
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});

		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-cache, no-transform");
		expect(response.headers.get("X-Accel-Buffering")).toBe("no");
		const streamText = await response.text();
		expect(streamText).toContain('"delta":"Hello "');
		expect(streamText).toContain('"delta":"from "');
		expect(streamText).toContain('"delta":"test"');
	});

	it("accepts SDK v6 tool approval message parts", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const response = await app.request("/ai/text-stream", {
			body: JSON.stringify({
				messages: [
					{
						id: "1",
						parts: [{ text: "search for the latest AI news", type: "text" }],
						role: "user"
					},
					{
						id: "2",
						parts: [
							{
								approval: { id: "approval-1" },
								input: { q: "latest AI news" },
								state: "approval-requested",
								toolCallId: "tool-1",
								type: "tool-serper"
							}
						],
						role: "assistant"
					}
				]
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});

		expect(response.status).toBe(200);
		const streamText = await response.text();
		expect(streamText).toContain('"delta":"Hello "');
	});
});
