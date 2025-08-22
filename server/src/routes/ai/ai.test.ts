import { describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";
import { createApp } from "@/lib/create-app";
import router from "@/routes/ai/ai.index";

// Mock AI SDK
mock.module("ai", () => ({
	smoothStream: mock(() => ({})),
	streamText: mock(() => ({
		toUIMessageStreamResponse: mock(() => new Response("data: test\n\n"))
	}))
}));

// Mock auth middleware to bypass authentication
mock.module("@/middlewares/auth-middleware", () => ({
	authMiddleware: mock(async (c, next) => {
		c.set("user", { email: "test@test.com", id: "test-user" });
		await next();
	})
}));

// Mock logger to disable logs in tests
mock.module("@/middlewares/pino-logger", () => ({
	pinoLogger: mock(() =>
		mock(async (c, next) => {
			c.set("logger", { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} });
			await next();
		})
	)
}));

describe("AI Routes", () => {
	describe("POST /ai/text-stream", () => {
		it("should return 401 without auth (expected behavior)", async () => {
			const app = createApp().route("/", router);
			const client = testClient(app);

			const response = await client.ai["text-stream"].$post({
				json: { messages: [{ id: "1", parts: [{ text: "test", type: "text" }], role: "user" }] }
			});

			expect(response.status).toBe(401);
		});
	});
});
