import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createApp } from "@/lib/create-app";
import { HonoRedisCache, invalidateCache, redisCache, userCache } from "@/middlewares/redis-cache-middleware";

type MockRedisClient = {
	del: ReturnType<typeof mock<(key: string, ...keys: string[]) => Promise<number>>>;
	exists: ReturnType<typeof mock<(key: string) => Promise<boolean | number>>>;
	get: ReturnType<typeof mock<(key: string) => Promise<string | null>>>;
	scan: ReturnType<
		typeof mock<
			(
				cursor: string | number,
				match: "MATCH",
				pattern: string,
				count: "COUNT",
				hint: number
			) => Promise<[string, string[]]>
		>
	>;
	set: ReturnType<typeof mock<(key: string, value: string, ex: "EX", ttl: number) => Promise<"OK">>>;
	ttl: ReturnType<typeof mock<(key: string) => Promise<number>>>;
};

// Mock Redis client
const mockRedisClient: MockRedisClient = {
	del: mock(() => Promise.resolve(1)),
	exists: mock(() => Promise.resolve(false)),
	get: mock(() => Promise.resolve(null)),
	scan: mock(() => Promise.resolve(["0", []])),
	set: mock(() => Promise.resolve("OK")),
	ttl: mock(() => Promise.resolve(-1))
};

describe("Redis Cache Middleware", () => {
	let cache: HonoRedisCache;

	beforeEach(() => {
		cache = new HonoRedisCache(mockRedisClient);
		// Reset all mocks
		Object.values(mockRedisClient).forEach((mockFn) => {
			mockFn.mockClear();
		});
	});

	describe("HonoRedisCache", () => {
		it("should get value from cache", async () => {
			const testData = { id: "test", name: "Test User" };
			mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(testData));

			const result = await cache.get("test-key", "test-namespace");

			expect(result).toEqual(testData);
			expect(mockRedisClient.get).toHaveBeenCalledWith("test-namespace:test-key");
		});

		it("should return null for cache miss", async () => {
			mockRedisClient.get.mockResolvedValueOnce(null);

			const result = await cache.get("missing-key", "test-namespace");

			expect(result).toBeNull();
		});

		it("should set value in cache", async () => {
			const testData = { id: "test", name: "Test User" };

			const result = await cache.set("test-key", testData, 300, "test-namespace");

			expect(result).toBe(true);
			expect(mockRedisClient.set).toHaveBeenCalledWith("test-namespace:test-key", JSON.stringify(testData), "EX", 300);
		});

		it("should delete value from cache", async () => {
			const result = await cache.del("test-key", "test-namespace");

			expect(result).toBe(true);
			expect(mockRedisClient.del).toHaveBeenCalledWith("test-namespace:test-key");
		});

		it("should check if key exists", async () => {
			mockRedisClient.exists.mockResolvedValueOnce(true);

			const result = await cache.exists("test-key", "test-namespace");

			expect(result).toBe(true);
			expect(mockRedisClient.exists).toHaveBeenCalledWith("test-namespace:test-key");
		});

		it("should get TTL", async () => {
			mockRedisClient.ttl.mockResolvedValueOnce(250);

			const result = await cache.ttl("test-key", "test-namespace");

			expect(result).toBe(250);
			expect(mockRedisClient.ttl).toHaveBeenCalledWith("test-namespace:test-key");
		});

		it("should delete matching keys using scan", async () => {
			mockRedisClient.scan
				.mockResolvedValueOnce(["10", ["test-namespace:user:one", "test-namespace:user:two"]])
				.mockResolvedValueOnce(["0", ["test-namespace:user:three"]]);
			mockRedisClient.del.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

			const result = await cache.delByPattern("user:*", "test-namespace");

			expect(result).toBe(3);
			expect(mockRedisClient.scan).toHaveBeenNthCalledWith(1, "0", "MATCH", "test-namespace:user:*", "COUNT", 100);
			expect(mockRedisClient.scan).toHaveBeenNthCalledWith(2, "10", "MATCH", "test-namespace:user:*", "COUNT", 100);
			expect(mockRedisClient.del).toHaveBeenNthCalledWith(1, "test-namespace:user:one", "test-namespace:user:two");
			expect(mockRedisClient.del).toHaveBeenNthCalledWith(2, "test-namespace:user:three");
		});
	});

	describe("Cache Invalidation", () => {
		it("should invalidate cache by key", () => {
			expect(typeof invalidateCache.byKey).toBe("function");
		});

		it("should invalidate cache by user", () => {
			expect(typeof invalidateCache.byUser).toBe("function");
		});

		it("should invalidate all cache", () => {
			expect(typeof invalidateCache.all).toBe("function");
		});
	});

	describe("Cache Middleware", () => {
		it("should create cache middleware with default options", () => {
			const middleware = redisCache();

			expect(middleware).toBeDefined();
			expect(typeof middleware).toBe("function");
		});

		it("should create cache middleware with custom options", () => {
			const middleware = redisCache({
				namespace: "custom-cache",
				onlySuccessful: false,
				ttl: 600
			});

			expect(middleware).toBeDefined();
		});

		it("should skip cache when skipCache returns true", () => {
			const middleware = redisCache({
				skipCache: () => true
			});

			expect(middleware).toBeDefined();
		});

		it("should scope user cache keys from jwtPayload when user is not set", async () => {
			const app = createApp();

			app.use("*", async (c, next) => {
				c.set("jwtPayload", {
					exp: 1,
					sub: {
						email: "test@example.com",
						id: "test-user",
						name: "Test User"
					}
				});
				await next();
			});

			app.use(
				"*",
				userCache("profile", {
					redisClient: mockRedisClient
				})
			);

			app.get("/profile", (c) => c.json({ ok: true }));

			await app.request("http://localhost/profile");

			expect(mockRedisClient.get).toHaveBeenCalledWith("hono-cache:user:test-user:profile");
		});
	});
});
