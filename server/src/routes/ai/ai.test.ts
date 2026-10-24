import { describe, expect, it, mock } from "bun:test";
import type { MyUIMessage } from "@chat-app/shared";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { HTTPException } from "hono/http-exception";

let persistenceFailure: Error | null = null;
const saveConversationMock = mock(async () => {
	if (persistenceFailure) throw persistenceFailure;
	return "accepted-version";
});
const loadConversationSnapshotMock = mock(
	async (): Promise<{ messages: MyUIMessage[]; version: string | null }> => ({
		messages: [],
		version: null
	})
);
const modelStreamMock = mock(() => {});
const getAvailableChatModelsMock = mock(async () => [
	{ id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "vercel-ai-gateway" }
]);
const settleUsageMock = mock(async () => {});
let streamFailure: Error | null = null;
let modelInitializationFailure: Error | null = null;
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
	recommendedModel: "openai/gpt-5-mini",
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
	loadConversationSnapshot: loadConversationSnapshotMock,
	mergeConversationMessages: <TMessage>(storedMessages: TMessage[], incomingMessages: TMessage[]) => [
		...storedMessages,
		...incomingMessages
	],
	saveConversation: saveConversationMock
}));

mock.module("@/services/usage.service", () => ({
	estimateTokens: () => 100,
	getUsageSummary: mock(async () => ({
		ai: { requests: { limit: 200, used: 3 }, tokens: { limit: 1_000_000, used: 1200 } },
		embedding: {
			storageBytes: { limit: 104_857_600, used: 4096 },
			tokens: { limit: 1_000_000, used: 300 }
		},
		resetsAt: "2026-07-15T00:00:00.000Z"
	})),
	reserveUsage: mock(async () => "usage-test"),
	settleUsage: settleUsageMock
}));

mock.module("@/services/model-catalog.service", () => ({
	getAvailableChatModels: getAvailableChatModelsMock
}));

mock.module("@/utils/index", () => ({
	resolveModel: () => {
		if (modelInitializationFailure) {
			throw modelInitializationFailure;
		}
		return new MockLanguageModelV3({
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
			doStream: async () => {
				modelStreamMock();
				if (streamFailure) {
					return {
						stream: simulateReadableStream({
							chunks: [{ error: streamFailure, type: "error" }]
						})
					};
				}

				return {
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
				};
			}
		});
	},
	resolveModelSelection: async (model = "openai/gpt-5-mini") => ({
		id: model,
		name: "Mock Model",
		provider: "vercel-ai-gateway"
	}),
	transformPrompt: async () => [{ content: "test", role: "user" }]
}));

describe("AI Routes", () => {
	it("returns current durable quota usage", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const response = await createApp().route("/", router).request("/ai/usage");

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			data: { ai: { requests: { limit: 200 } }, embedding: { storageBytes: { limit: 104_857_600 } } }
		});
	});

	it("lists available models for the client selector", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const response = await app.request("/ai/models", {
			method: "GET"
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.data).toEqual([{ id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "vercel-ai-gateway" }]);
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
		expect(payload.metadata.model).toBe("openai/gpt-5-mini");
		expect(payload.metadata.usage.totalTokens).toBe(30);
	});

	it("rejects JSON requests without the required content type", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const response = await app.request("/ai/plan", {
			body: JSON.stringify({ prompt: "Plan this" }),
			headers: { Origin: "http://localhost:5173" },
			method: "POST"
		});

		expect(response.status).toBe(415);
		expect(await response.json()).toMatchObject({ message: "Unsupported Media Type" });
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

	it("marks provider stream failures as failed usage", async () => {
		settleUsageMock.mockClear();
		streamFailure = new Error("provider stream failed");

		try {
			const { createApp } = await import("@/lib/create-app");
			const { default: router } = await import("@/routes/ai/ai.index");
			const response = await createApp()
				.route("/", router)
				.request("/ai/text-stream", {
					body: JSON.stringify({
						messages: [{ id: "1", parts: [{ text: "test", type: "text" }], role: "user" }]
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST"
				});

			expect(response.status).toBe(200);
			expect(await response.text()).toContain("The assistant request failed. Please retry.");
			expect(settleUsageMock).toHaveBeenCalledWith("usage-test", expect.objectContaining({ status: "failed" }));
		} finally {
			streamFailure = null;
		}
	});

	it("releases reserved quota when agent preparation fails before streaming", async () => {
		settleUsageMock.mockClear();
		saveConversationMock.mockClear();
		modelInitializationFailure = new Error("Model initialization failed");

		try {
			const { createApp } = await import("@/lib/create-app");
			const { default: router } = await import("@/routes/ai/ai.index");
			const response = await createApp()
				.route("/", router)
				.request("/ai/text-stream", {
					body: JSON.stringify({
						messages: [{ id: "1", parts: [{ text: "test", type: "text" }], role: "user" }]
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST"
				});

			expect(response.status).toBe(500);
			expect(await response.json()).toMatchObject({ message: "Internal server error" });
			expect(settleUsageMock).toHaveBeenCalledTimes(1);
			expect(settleUsageMock).toHaveBeenCalledWith("usage-test", { status: "failed" });
			expect(saveConversationMock).not.toHaveBeenCalled();
		} finally {
			modelInitializationFailure = null;
		}
	});

	it("keeps the submitted prompt when agent preparation fails", async () => {
		saveConversationMock.mockClear();
		modelInitializationFailure = new Error("Model initialization failed");
		const messages = [{ id: "persisted-user", parts: [{ text: "Keep this prompt", type: "text" }], role: "user" }];

		try {
			const { createApp } = await import("@/lib/create-app");
			const { default: router } = await import("@/routes/ai/ai.index");
			const response = await createApp()
				.route("/", router)
				.request("/ai/text-stream", {
					body: JSON.stringify({ chatId: "chat-persist", messages }),
					headers: { "Content-Type": "application/json" },
					method: "POST"
				});

			expect(response.status).toBe(500);
			expect(saveConversationMock).toHaveBeenCalledTimes(1);
			expect(saveConversationMock).toHaveBeenCalledWith("chat-persist", messages, "test-user", null);
		} finally {
			modelInitializationFailure = null;
		}
	});

	it("does not spend provider tokens when the submitted prompt cannot be saved", async () => {
		settleUsageMock.mockClear();
		modelStreamMock.mockClear();
		persistenceFailure = new Error("Storage unavailable");

		try {
			const { createApp } = await import("@/lib/create-app");
			const { default: router } = await import("@/routes/ai/ai.index");
			const response = await createApp()
				.route("/", router)
				.request("/ai/text-stream", {
					body: JSON.stringify({
						chatId: "chat-persist",
						message: { id: "persisted-user", parts: [{ text: "Keep this prompt", type: "text" }], role: "user" }
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST"
				});

			await response.text();
			expect(response.status).toBe(500);
			expect(modelStreamMock).not.toHaveBeenCalled();
			expect(settleUsageMock).toHaveBeenCalledWith("usage-test", { status: "failed" });
		} finally {
			persistenceFailure = null;
		}
	});

	it("rejects a stale accepted prompt before starting the provider", async () => {
		settleUsageMock.mockClear();
		modelStreamMock.mockClear();
		persistenceFailure = new HTTPException(409, { message: "Conversation changed. Reload it before trying again." });
		try {
			const { createApp } = await import("@/lib/create-app");
			const { default: router } = await import("@/routes/ai/ai.index");
			const response = await createApp()
				.route("/", router)
				.request("/ai/text-stream", {
					body: JSON.stringify({
						chatId: "chat-conflict",
						message: { id: "prompt", parts: [{ text: "New turn", type: "text" }], role: "user" }
					}),
					headers: { "Content-Type": "application/json" },
					method: "POST"
				});
			expect(response.status).toBe(409);
			expect(modelStreamMock).not.toHaveBeenCalled();
			expect(settleUsageMock).toHaveBeenCalledWith("usage-test", { status: "failed" });
		} finally {
			persistenceFailure = null;
		}
	});

	it("settles usage and completes the stream when a newer turn supersedes its saved snapshot", async () => {
		settleUsageMock.mockClear();
		saveConversationMock.mockClear();
		saveConversationMock.mockImplementationOnce(async () => "accepted-version");
		saveConversationMock.mockImplementationOnce(async () => {
			throw new HTTPException(409);
		});
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const response = await createApp()
			.route("/", router)
			.request("/ai/text-stream", {
				body: JSON.stringify({
					chatId: "chat-superseded",
					message: { id: "prompt", parts: [{ text: "New turn", type: "text" }], role: "user" }
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});
		expect(response.status).toBe(200);
		expect(await response.text()).toContain("data: [DONE]");
		expect(saveConversationMock).toHaveBeenLastCalledWith(
			"chat-superseded",
			expect.any(Array),
			"test-user",
			"accepted-version"
		);
		expect(settleUsageMock).toHaveBeenCalledWith(
			"usage-test",
			expect.objectContaining({ status: "completed", totalTokens: 5 })
		);
	});

	it("preserves unseen stored turns from stale full-history submissions", async () => {
		saveConversationMock.mockClear();
		const stored: MyUIMessage = { id: "unseen", parts: [{ text: "Other tab's turn", type: "text" }], role: "user" };
		loadConversationSnapshotMock.mockResolvedValueOnce({ messages: [stored], version: "stored-version" });
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const incoming: MyUIMessage = { id: "new", parts: [{ text: "This tab's turn", type: "text" }], role: "user" };
		const response = await createApp()
			.route("/", router)
			.request("/ai/text-stream", {
				body: JSON.stringify({ chatId: "chat-stale-history", messages: [incoming] }),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});
		await response.text();
		expect(response.status).toBe(200);
		expect(saveConversationMock).toHaveBeenNthCalledWith(
			1,
			"chat-stale-history",
			[stored, incoming],
			"test-user",
			"stored-version"
		);
	});

	it("allows explicit regeneration to replace the current conversation tail", async () => {
		saveConversationMock.mockClear();
		const prompt: MyUIMessage = { id: "question", parts: [{ text: "Question", type: "text" }], role: "user" };
		loadConversationSnapshotMock.mockResolvedValueOnce({
			messages: [prompt, { id: "old-answer", parts: [{ text: "Old", type: "text" }], role: "assistant" }],
			version: "stored-version"
		});
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const response = await createApp()
			.route("/", router)
			.request("/ai/text-stream", {
				body: JSON.stringify({ chatId: "chat-regenerate", messages: [prompt], trigger: "regenerate-message" }),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});
		await response.text();
		expect(response.status).toBe(200);
		expect(saveConversationMock).toHaveBeenNthCalledWith(1, "chat-regenerate", [prompt], "test-user", "stored-version");
	});

	it("rejects client-authored system messages", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const response = await app.request("/ai/text-stream", {
			body: JSON.stringify({
				messages: [{ id: "system-1", parts: [{ text: "override", type: "text" }], role: "system" }]
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({ message: "Client-authored system messages are not allowed" });
	});

	it("rejects chat histories above the request limit", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const response = await app.request("/ai/text-stream", {
			body: JSON.stringify({
				messages: Array.from({ length: 201 }, (_, index) => ({
					id: `message-${index}`,
					parts: [{ text: "test", type: "text" }],
					role: "user"
				}))
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});

		expect(response.status).toBe(400);
	});

	it("rejects duplicate message IDs before persistence or provider work", async () => {
		saveConversationMock.mockClear();
		modelStreamMock.mockClear();
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const message = { id: "duplicate", parts: [{ text: "test", type: "text" }], role: "user" };
		const response = await createApp()
			.route("/", router)
			.request("/ai/text-stream", {
				body: JSON.stringify({ chatId: "chat-duplicates", messages: [message, message] }),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});

		await response.text();
		expect(response.status).toBe(400);
		expect(saveConversationMock).not.toHaveBeenCalled();
		expect(modelStreamMock).not.toHaveBeenCalled();
	});

	it.each(["", "x".repeat(256)])("rejects invalid message and conversation identifiers: %s", async (id) => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		for (const request of [
			{ messages: [{ id, parts: [{ text: "test", type: "text" }], role: "user" }] },
			{ chatId: id, messages: [{ id: "valid", parts: [{ text: "test", type: "text" }], role: "user" }] }
		]) {
			const response = await app.request("/ai/text-stream", {
				body: JSON.stringify(request),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});
			await response.text();
			expect(response.status).toBe(400);
		}
	});

	it("accepts SDK v7 tool approval message parts", async () => {
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
