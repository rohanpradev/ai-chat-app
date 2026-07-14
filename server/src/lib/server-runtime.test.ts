import { describe, expect, it, mock } from "bun:test";
import { configureRequestIdleTimeout, createServerOptions } from "@/lib/server-runtime";

describe("Bun server runtime", () => {
	it("disables Bun's idle timeout only for the AI event stream", () => {
		const timeout = mock(() => {});
		const server = { timeout };
		const streamRequest = new Request("http://localhost/api/ai/text-stream", { method: "POST" });
		const regularRequest = new Request("http://localhost/api/ai/models");

		configureRequestIdleTimeout(streamRequest, server, "api");
		configureRequestIdleTimeout(regularRequest, server, "api");

		expect(timeout).toHaveBeenCalledTimes(1);
		expect(timeout).toHaveBeenCalledWith(streamRequest, 0);
	});

	it("keeps the global idle timeout above Hono's request timeout", () => {
		const options = createServerOptions({
			apiSlug: "api",
			fetch: () => new Response("ok"),
			port: 3000
		});

		expect(options.idleTimeout).toBe(185);
		expect(options.port).toBe(3000);
	});
});
