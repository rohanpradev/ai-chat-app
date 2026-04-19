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

	it("returns a generic message for unexpected server errors", async () => {
		const app = createApp();
		app.get("/boom", () => {
			throw new Error("sensitive internal failure");
		});

		const response = await app.request("/boom");
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.message).toBe("Internal server error");
	});

	it("echoes allowed origins for credentialed CORS requests", async () => {
		const app = createApp();
		const response = await app.request("/health", {
			headers: {
				Origin: "http://localhost:5173"
			}
		});

		expect(response.headers.get("access-control-allow-origin")).toBe("http://localhost:5173");
		expect(response.headers.get("access-control-allow-credentials")).toBe("true");
	});

	it("does not grant credentialed CORS access to unknown origins", async () => {
		const app = createApp();
		const response = await app.request("/health", {
			headers: {
				Origin: "https://malicious.example"
			}
		});

		expect(response.headers.get("access-control-allow-origin")).toBeNull();
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
