import { describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import type { AppBindings } from "@/lib/types";
import { createRateLimit, type RedisRateLimitClient } from "@/middlewares/rate-limit";

const fixedNow = 120_000;

const createApp = (middleware: ReturnType<typeof createRateLimit>, userId = "user-1") => {
	const app = new Hono<AppBindings>();
	app.use("*", async (c, next) => {
		c.set("user", { email: `${userId}@example.com`, id: userId, name: userId });
		await next();
	});
	app.use("*", middleware);
	app.get("/limited", (c) => c.json({ ok: true }));
	return app;
};

describe("Redis rate limiter", () => {
	it("uses one atomic Redis command and keys limits by authenticated user", async () => {
		const counts = new Map<string, number>();
		const send = mock(async (command: string, args: string[]) => {
			expect(command).toBe("EVAL");
			const key = args[2] ?? "";
			const count = (counts.get(key) ?? 0) + 1;
			counts.set(key, count);
			return [count, 60_000];
		});
		const limiter = createRateLimit({
			keyPrefix: "test",
			limit: 1,
			now: () => fixedNow,
			redisClient: { send },
			windowMs: 60_000
		});
		const app = createApp(limiter);

		const firstResponse = await app.request("/limited", {
			headers: { "X-Forwarded-For": "198.51.100.10" }
		});
		const secondResponse = await app.request("/limited", {
			headers: { "X-Forwarded-For": "203.0.113.20" }
		});

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(429);
		expect(send).toHaveBeenCalledTimes(2);
		expect(send.mock.calls[0]?.[1][2]).toContain("user%3Auser-1");
		expect(send.mock.calls[0]?.[1][2]).not.toContain("198.51.100.10");
		expect(send.mock.calls[0]?.[1][2]).toBe(send.mock.calls[1]?.[1][2]);
		expect(secondResponse.headers.get("RateLimit-Limit")).toBe("1");
		expect(secondResponse.headers.get("RateLimit-Remaining")).toBe("0");
		expect(secondResponse.headers.get("RateLimit-Reset")).toBe("60");
		expect(secondResponse.headers.get("RateLimit-Policy")).toBe("1;w=60");
		expect(secondResponse.headers.get("Retry-After")).toBe("60");
	});

	it("isolates buckets for different authenticated users", async () => {
		const counts = new Map<string, number>();
		const redisClient: RedisRateLimitClient = {
			send: async (_command, args) => {
				const key = args[2] ?? "";
				const count = (counts.get(key) ?? 0) + 1;
				counts.set(key, count);
				return [count, 60_000];
			}
		};
		const options = {
			keyPrefix: "test-users",
			limit: 1,
			now: () => fixedNow,
			redisClient,
			windowMs: 60_000
		};

		const firstResponse = await createApp(createRateLimit(options), "user-1").request("/limited");
		const secondResponse = await createApp(createRateLimit(options), "user-2").request("/limited");

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(200);
		expect(counts.size).toBe(2);
	});

	it("falls back to a bounded local user bucket for the rest of a failed Redis window", async () => {
		const send = mock(async () => {
			throw new Error("Redis unavailable");
		});
		const limiter = createRateLimit({
			keyPrefix: "test-fallback",
			limit: 1,
			now: () => fixedNow,
			redisClient: { send },
			windowMs: 60_000
		});
		const app = createApp(limiter);

		const firstResponse = await app.request("/limited");
		const secondResponse = await app.request("/limited");

		expect(firstResponse.status).toBe(200);
		expect(secondResponse.status).toBe(429);
		expect(send).toHaveBeenCalledTimes(1);
		expect(secondResponse.headers.get("RateLimit-Remaining")).toBe("0");
	});
});
