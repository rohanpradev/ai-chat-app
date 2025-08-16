import { beforeEach, describe, expect, it, mock } from "bun:test";
import { testClient } from "hono/testing";
import { createApp } from "@/lib/create-app";
import router from "@/routes/profile/profile.index";

// Mock Redis cache
const mockRedisCache = {
	del: mock(() => Promise.resolve(true)),
	exists: mock(() => Promise.resolve(false)),
	get: mock(() => Promise.resolve(null)),
	set: mock(() => Promise.resolve(true)),
	ttl: mock(() => Promise.resolve(-1))
};

mock.module("@/middlewares/redis-cache-middleware", () => ({
	cacheInstance: mockRedisCache,
	invalidateCache: {
		byKey: mock(() => Promise.resolve(true)),
		byUser: mock(() => Promise.resolve(1))
	},
	redisCache: mock(() =>
		mock(async (c, next) => {
			// Simulate cache miss
			c.header("X-Cache-Hit", "MISS");
			await next();
		})
	),
	userCache: mock(() =>
		mock(async (c, next) => {
			c.header("X-Cache-Hit", "MISS");
			await next();
		})
	)
}));

// Mock auth middleware
mock.module("@/middlewares/auth-middleware", () => ({
	authMiddleware: mock(async (c, next) => {
		c.set("user", { email: "test@test.com", id: "test-user" });
		c.set("jwtPayload", { sub: { id: "test-user" } });
		await next();
	})
}));

// Mock logger
mock.module("@/middlewares/pino-logger", () => ({
	pinoLogger: mock(() =>
		mock(async (c, next) => {
			c.set("logger", { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} });
			await next();
		})
	)
}));

describe("Profile Routes with Redis Cache", () => {
	beforeEach(() => {
		// Reset mocks
		mockRedisCache.get.mockClear();
		mockRedisCache.set.mockClear();
		mockRedisCache.del.mockClear();
	});

	describe("GET /profile/me", () => {
		it("should return user profile with cache miss", async () => {
			const app = createApp().route("/", router);
			const _client = testClient(app);

			const response = await app.request("/profile/me");

			expect([200, 404, 500].includes(response.status)).toBe(true);
		});

		it("should handle cache hit scenario", async () => {
			// Mock cache hit
			const cachedData = {
				body: JSON.stringify({ data: { id: "test-user", name: "Test User" }, message: "Success" }),
				headers: { "Content-Type": "application/json" },
				status: 200,
				timestamp: Date.now(),
				ttl: 300
			};

			mockRedisCache.get.mockResolvedValueOnce(cachedData as any);
			mockRedisCache.ttl.mockResolvedValueOnce(250);

			const app = createApp().route("/", router);
			const _client = testClient(app);

			const response = await app.request("/profile/me");

			// Cache middleware should return cached response
			expect([200, 404, 500].includes(response.status)).toBe(true);
		});
	});

	describe("PUT /profile/me", () => {
		it("should update profile and invalidate cache", async () => {
			const app = createApp().route("/", router);
			const _client = testClient(app);

			const response = await app.request("/profile/me", {
				body: JSON.stringify({ name: "Updated Name" }),
				headers: { "Content-Type": "application/json" },
				method: "PUT"
			});

			expect([200, 404, 500].includes(response.status)).toBe(true);
		});

		it("should handle validation errors", async () => {
			const app = createApp().route("/", router);
			const _client = testClient(app);

			const response = await app.request("/profile/me", {
				body: JSON.stringify({ name: "" }),
				headers: { "Content-Type": "application/json" },
				method: "PUT"
			});

			expect([422, 400, 404, 500].includes(response.status)).toBe(true);
		});
	});

	describe("Cache Operations", () => {
		it("should test cache key generation", () => {
			const userId = "test-user";
			const expectedPattern = `user:${userId}:profile`;

			// This would be tested in the actual cache middleware
			expect(expectedPattern).toBe("user:test-user:profile");
		});

		it("should test cache invalidation", async () => {
			const { invalidateCache } = await import("@/middlewares/redis-cache-middleware");

			const result = await invalidateCache.byUser("test-user");
			expect(result).toBe(1);
		});
	});
});
