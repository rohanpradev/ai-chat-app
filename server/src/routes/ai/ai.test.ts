import { describe, expect, it, mock } from "bun:test";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { testClient } from "hono/testing";

const saveConversationMock = mock(async () => {});

mock.module("@/middlewares/auth-middleware", () => ({
	authMiddleware: mock(async (c, next) => {
		c.set("jwtPayload", { sub: { id: "test-user" } });
		await next();
	})
}));

mock.module("@/services/conversation.service", () => ({
	saveConversation: saveConversationMock
}));

mock.module("@/utils/index", () => ({
	MODELS: {
		azureOpenAI: () =>
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
			})
	},
	transformPrompt: async () => [{ content: "test", role: "user" }]
}));

describe("AI Routes", () => {
	it("streams deterministic output using ai/test mock model", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/ai/ai.index");
		const app = createApp().route("/", router);
		const client = testClient(app);

		const response = await client.ai["text-stream"].$post({
			json: {
				messages: [{ id: "1", parts: [{ text: "test", type: "text" }], role: "user" }]
			}
		});

		expect(response.status).toBe(200);
		const streamText = await response.text();
		expect(streamText).toContain('"delta":"Hello "');
		expect(streamText).toContain('"delta":"from "');
		expect(streamText).toContain('"delta":"test"');
	});
});
