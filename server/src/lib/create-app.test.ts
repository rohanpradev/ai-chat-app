import { describe, expect, it } from "bun:test";
import { HTTPException } from "hono/http-exception";
import configureOpenAPI from "@/lib/configure-open-api";
import { createApp } from "@/lib/create-app";
import { beginShutdown, resetLifecycleForTests } from "@/lib/lifecycle";
import env from "@/utils/env";

describe("App Creation", () => {
	it("should create app successfully", () => {
		const app = createApp();
		expect(app).toBeDefined();
	});

	it("should handle health check", async () => {
		const app = createApp();
		const response = await app.request("/health");

		expect(response.status).toBe(200);
		expect(response.headers.get("x-request-id")).toMatch(/^[\w=-]+$/);
	});

	it("echoes valid request IDs and replaces invalid values", async () => {
		const app = createApp();
		const acceptedResponse = await app.request("/health", {
			headers: { "X-Request-Id": "client-request_123" }
		});
		const replacedResponse = await app.request("/health", {
			headers: { "X-Request-Id": "invalid request id" }
		});

		expect(acceptedResponse.headers.get("x-request-id")).toBe("client-request_123");
		expect(replacedResponse.headers.get("x-request-id")).not.toBe("invalid request id");
		expect(replacedResponse.headers.get("x-request-id")).toMatch(/^[\w=-]+$/);
	});

	it("should expose health check behind the API slug for ingress smoke tests", async () => {
		const app = createApp();
		const response = await app.request(`/${env.BASE_API_SLUG}/health`);

		expect(response.status).toBe(200);
	});

	it("reports readiness and rejects new traffic during shutdown", async () => {
		const app = createApp();

		try {
			const readyResponse = await app.request("/ready");
			expect(readyResponse.status).toBe(200);
			expect(await readyResponse.json()).toEqual({ status: "ready" });

			beginShutdown();
			const shuttingDownResponse = await app.request("/ready");
			expect(shuttingDownResponse.status).toBe(503);
			expect(await shuttingDownResponse.json()).toEqual({ status: "shutting_down" });
		} finally {
			resetLifecycleForTests();
		}
	});

	it("adds ETags only to cacheable non-streaming GET and HEAD responses", async () => {
		const app = createApp();
		app.get("/cacheable", (c) => c.json({ ok: true }));
		app.post("/cacheable", (c) => c.json({ ok: true }));

		const getResponse = await app.request("/cacheable");
		const etag = getResponse.headers.get("etag");
		const postResponse = await app.request("/cacheable", {
			headers: { Origin: env.CLIENT_URL },
			method: "POST"
		});

		expect(etag).not.toBeNull();
		expect(postResponse.headers.get("etag")).toBeNull();

		const notModifiedResponse = await app.request("/cacheable", {
			headers: {
				"If-None-Match": etag ?? "",
				Origin: env.CLIENT_URL,
				"X-Request-Id": "conditional-request"
			}
		});

		expect(notModifiedResponse.status).toBe(304);
		expect(notModifiedResponse.headers.get("access-control-allow-credentials")).toBe("true");
		expect(notModifiedResponse.headers.get("access-control-allow-origin")).toBe(env.CLIENT_URL);
		expect(notModifiedResponse.headers.get("x-request-id")).toBe("conditional-request");
	});

	it("keeps HEAD responses consistent with GET responses", async () => {
		const app = createApp();
		app.get("/head-check", (c) => c.json({ ok: true }));

		const getResponse = await app.request("/head-check");
		const headResponse = await app.request("/head-check", { method: "HEAD" });

		expect(headResponse.status).toBe(getResponse.status);
		expect(headResponse.headers.get("content-type")).toBe(getResponse.headers.get("content-type"));
		expect(headResponse.headers.get("etag")).toBe(getResponse.headers.get("etag"));
		expect(headResponse.body).toBeNull();
	});

	it("prevents private API responses from being stored or assigned ETags", async () => {
		const app = createApp();
		app.get(`/${env.BASE_API_SLUG}/private`, (c) => c.json({ private: true }));

		const response = await app.request(`/${env.BASE_API_SLUG}/private`);

		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("etag")).toBeNull();
	});

	it("returns event streams without waiting for completion or generating an ETag", async () => {
		const app = createApp();
		let closeStream = () => {};
		const stream = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('data: {"type":"start"}\n\n'));
				closeStream = () => controller.close();
			}
		});

		app.get(
			"/events",
			(_c) =>
				new Response(stream, {
					headers: { "Content-Type": "text/event-stream" }
				})
		);

		const responsePromise = Promise.resolve(app.request("/events"));
		const outcome = await Promise.race([
			responsePromise.then(() => "response" as const),
			Bun.sleep(100).then(() => "timeout" as const)
		]);
		closeStream();
		const response = await responsePromise;

		expect(outcome).toBe("response");
		expect(response.headers.get("etag")).toBeNull();
		expect(await response.text()).toContain('"type":"start"');
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

	it("preserves HTTPException status and headers in JSON error responses", async () => {
		const app = createApp();
		app.get("/unauthorized", () => {
			throw new HTTPException(401, {
				message: "Authentication required",
				res: new Response(null, {
					headers: { "WWW-Authenticate": 'Bearer realm="api"' }
				})
			});
		});

		const response = await app.request("/unauthorized");
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(response.headers.get("www-authenticate")).toBe('Bearer realm="api"');
		expect(body.message).toBe("Authentication required");
	});

	it("does not trust status-like properties on unexpected errors", async () => {
		const app = createApp();
		app.get("/status-shaped-error", () => {
			throw Object.assign(new Error("sensitive validation detail"), { status: 400 });
		});

		const response = await app.request("/status-shaped-error");
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

	it("keeps application and proxy CORS policies aligned for preflight requests", async () => {
		const app = createApp();
		const response = await app.request(`/${env.BASE_API_SLUG}/health`, {
			headers: {
				"Access-Control-Request-Headers": "Content-Type, X-Request-ID, Sentry-Trace, Baggage",
				"Access-Control-Request-Method": "POST",
				Origin: env.CLIENT_URL
			},
			method: "OPTIONS"
		});
		const allowedHeaders = response.headers
			.get("access-control-allow-headers")
			?.split(",")
			.map((header) => header.trim().toLowerCase());
		const allowedMethods = response.headers
			.get("access-control-allow-methods")
			?.split(",")
			.map((method) => method.trim());

		expect(response.status).toBe(204);
		expect(response.headers.get("access-control-allow-origin")).toBe(env.CLIENT_URL);
		expect(response.headers.get("access-control-allow-credentials")).toBe("true");
		expect(response.headers.get("access-control-max-age")).toBe("86400");
		expect(allowedHeaders).toEqual(expect.arrayContaining(["baggage", "content-type", "sentry-trace", "x-request-id"]));
		expect(allowedMethods).toEqual(expect.arrayContaining(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]));
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

	it("rejects wildcard credentialed CORS in production", () => {
		const originalNodeEnv = env.NODE_ENV;
		const originalCorsOrigins = env.CORS_ORIGINS;

		env.NODE_ENV = "production";
		env.CORS_ORIGINS = "*";

		try {
			expect(() => createApp()).toThrow("CORS_ORIGINS cannot include '*'");
		} finally {
			env.NODE_ENV = originalNodeEnv;
			env.CORS_ORIGINS = originalCorsOrigins;
		}
	});

	it("should serve the OpenAPI document", async () => {
		const app = createApp();
		configureOpenAPI(app);
		const response = await app.request("/doc");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("application/json");

		const body = await response.json();
		expect(body.info.title).toBe("Chat App API");
		expect(body.openapi).toBe("3.1.0");
		expect(body.servers).toEqual([{ description: "Current deployment", url: "/" }]);
		expect(body.tags).toHaveLength(5);
		expect(body.components.securitySchemes.CookieAuth).toEqual({
			description: "Better Auth session cookie",
			in: "cookie",
			name: "better-auth.session_token",
			type: "apiKey"
		});
	});

	it("should serve the Scalar API reference", async () => {
		const app = createApp();
		configureOpenAPI(app);
		const response = await app.request("/reference");
		const html = await response.text();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toContain("text/html");
		expect(html).toContain("<title>Chat App API Reference</title>");
		expect(response.headers.get("content-security-policy")).toContain("script-src");
		expect(response.headers.get("content-security-policy")).toContain("'nonce-");
		expect(html).toContain("@scalar/api-reference@1.62.5");
		expect(html).toContain('"title": "App API"');
		expect(html).toContain('"url": "/doc"');
		expect(html).toContain('"title": "Auth API"');
		expect(html).toContain('"url": "/api/auth/open-api/generate-schema"');
		expect(html).toContain('"preferredSecurityScheme": "CookieAuth"');
		expect(html).toContain('"telemetry": false');
	});
});
