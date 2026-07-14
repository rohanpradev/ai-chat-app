import { beforeEach, describe, expect, it, mock } from "bun:test";

const returningMock = mock(async () => [{ id: "chat-1" }]);
const whereMock = mock(() => ({ returning: returningMock }));
const deleteMock = mock(() => ({ where: whereMock }));

mock.module("@/db", () => ({
	db: {
		delete: deleteMock
	}
}));

mock.module("@/middlewares/auth-middleware", () => ({
	authMiddleware: mock(async (c, next) => {
		c.set("jwtPayload", { sub: { id: "test-user" } });
		await next();
	})
}));

describe("Conversation Routes", () => {
	beforeEach(() => {
		deleteMock.mockClear();
		whereMock.mockClear();
		returningMock.mockClear();
		returningMock.mockResolvedValue([{ id: "chat-1" }]);
	});

	it("deletes an owned conversation", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/conversations/conversations.index");
		const app = createApp().route("/", router);
		const response = await app.request("/conversations/chat-1", {
			headers: { Origin: "http://localhost:5173" },
			method: "DELETE"
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			data: { id: "chat-1" },
			message: "Conversation deleted successfully"
		});
		expect(deleteMock).toHaveBeenCalledTimes(1);
	});

	it("returns not found when the conversation is not owned", async () => {
		returningMock.mockResolvedValueOnce([]);
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/conversations/conversations.index");
		const app = createApp().route("/", router);
		const response = await app.request("/conversations/missing", {
			headers: { Origin: "http://localhost:5173" },
			method: "DELETE"
		});

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({ message: "Conversation not found" });
	});
});
