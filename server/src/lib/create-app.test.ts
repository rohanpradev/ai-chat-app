import { describe, expect, it } from "bun:test";
import { createApp } from "@/lib/create-app";

describe("App Creation", () => {
	it("should create app successfully", () => {
		const app = createApp();
		expect(app).toBeDefined();
	});

	it("should handle health check", async () => {
		const app = createApp();
		const response = await app.request("/health");

		expect(response.status).toBe(200);
	});

	it("should handle 404 for unknown routes", async () => {
		const app = createApp();
		const response = await app.request("/unknown-route");

		expect(response.status).toBe(404);
	});
});
