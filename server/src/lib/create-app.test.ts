import { describe, expect, it } from "bun:test";
import configureOpenAPI from "@/lib/configure-open-api";
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

	it("should serve the OpenAPI document", async () => {
		const app = createApp();
		configureOpenAPI(app);
		const response = await app.request("/doc");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/json");

		const body = await response.json();
		expect(body.info.title).toBe("AI API");
		expect(body.openapi).toBe("3.0.0");
	});

	it("should serve the Scalar API reference", async () => {
		const app = createApp();
		configureOpenAPI(app);
		const response = await app.request("/reference");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(await response.text()).toContain("<title>AI API Reference</title>");
	});
});
