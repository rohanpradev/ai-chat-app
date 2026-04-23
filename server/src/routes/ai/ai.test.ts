import { describe, expect, it, mock } from "bun:test";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";

const saveConversationMock = mock(async () => {});
const getAvailableChatModelsMock = mock(async () => [{ id: "gpt-5.4", name: "GPT-5.4", provider: "openai" }]);

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
	resolveModelSelection: async (model = "gpt-5.4") => ({
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
		expect(payload.data).toEqual([{ id: "gpt-5.4", name: "GPT-5.4", provider: "openai" }]);
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
