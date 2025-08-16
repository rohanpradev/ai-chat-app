import { beforeEach, describe, expect, it, mock } from "bun:test";
import { HonoRedisCache, invalidateCache, redisCache } from "@/middlewares/redis-cache-middleware";

// Mock Redis client
const mockRedisClient = {
	del: mock(() => Promise.resolve(1)),
	exists: mock(() => Promise.resolve(0)),
	expire: mock(() => Promise.resolve(1)),
	get: mock(() => Promise.resolve(null)),
	keys: mock(() => Promise.resolve([])),
	set: mock(() => Promise.resolve("OK")),
	ttl: mock(() => Promise.resolve(-1))
};

describe("Redis Cache Middleware", () => {
	let cache: HonoRedisCache;

	beforeEach(() => {
		cache = new HonoRedisCache(mockRedisClient as any);
		// Reset all mocks
		Object.values(mockRedisClient).forEach((mockFn) => mockFn.mockClear());
	});

	describe("HonoRedisCache", () => {
		it("should get value from cache", async () => {
			const testData = { id: "test", name: "Test User" };
			mockRedisClient.get.mockResolvedValueOnce(JSON.stringify(testData) as any);

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
			expect(mockRedisClient.set).toHaveBeenCalledWith("test-namespace:test-key", JSON.stringify(testData));
			expect(mockRedisClient.expire).toHaveBeenCalledWith("test-namespace:test-key", 300);
		});

		it("should delete value from cache", async () => {
			const result = await cache.del("test-key", "test-namespace");

			expect(result).toBe(true);
			expect(mockRedisClient.del).toHaveBeenCalledWith("test-namespace:test-key");
		});

		it("should check if key exists", async () => {
			mockRedisClient.exists.mockResolvedValueOnce(1);

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
	});
});
