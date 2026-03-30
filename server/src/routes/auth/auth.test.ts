import { describe, expect, it, mock } from "bun:test";

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
	redisCache: mock(() =>
		mock(async (c, next) => {
			// Simulate cache miss
			c.header("X-Cache-Hit", "MISS");
			await next();
		})
	)
}));

// Mock auth middleware
mock.module("@/middlewares/auth-middleware", () => ({
	authMiddleware: mock(async (c, next) => {
		// Set JWT payload for cache key generation
		c.set("jwtPayload", { sub: { id: "test-user" } });
		c.set("user", {
			email: "test@test.com",
			id: "test-user",
			name: "Test User"
		});
		await next();
	})
}));

// Mock logger
mock.module("@/middlewares/pino-logger", () => ({
	pinoLogger: mock(() =>
		mock(async (c, next) => {
			c.set("logger", {
				debug: () => {},
				error: () => {},
				info: () => {},
				warn: () => {}
			});
			await next();
		})
	)
}));

// Mock database
const mockDb = {
	query: {
		users: {
			findFirst: mock(() =>
				Promise.resolve({
					email: "test@test.com",
					id: "test-user",
					name: "Test User"
				})
			)
		}
	}
};

mock.module("@/db", () => ({
	db: mockDb,
	default: mockDb
}));

const createAuthApp = async () => {
	const { createApp } = await import("@/lib/create-app");
	const { default: router } = await import("@/routes/auth/auth.index");

	return createApp().route("/", router);
};

describe("Auth Routes", () => {
	describe("POST /auth/register", () => {
		it("should return validation error for missing fields", async () => {
			const app = await createAuthApp();
			const response = await app.request("/auth/register", {
				body: JSON.stringify({
					confirmPassword: "",
					email: "",
					name: "",
					password: ""
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});

			expect([422, 401].includes(response.status)).toBe(true);
		});

		it("should return validation error for invalid email", async () => {
			const app = await createAuthApp();
			const response = await app.request("/auth/register", {
				body: JSON.stringify({
					confirmPassword: "password123",
					email: "invalid-email",
					name: "Test",
					password: "password123"
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});

			expect([422, 401].includes(response.status)).toBe(true);
		});
	});

	describe("POST /auth/login", () => {
		it("should return error for missing credentials", async () => {
			const app = await createAuthApp();
			const response = await app.request("/auth/login", {
				body: JSON.stringify({ email: "", password: "" }),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});

			expect([422, 401].includes(response.status)).toBe(true);
		});

		it("should return error for invalid credentials", async () => {
			const app = await createAuthApp();
			const response = await app.request("/auth/login", {
				body: JSON.stringify({
					email: "nonexistent@test.com",
					password: "wrongpassword"
				}),
				headers: { "Content-Type": "application/json" },
				method: "POST"
			});

			expect([401, 404, 500].includes(response.status)).toBe(true);
		});
	});

	describe("POST /auth/logout", () => {
		it("should handle logout endpoint", async () => {
			const app = await createAuthApp();
			const response = await app.request("/auth/logout", { method: "POST" });

			// Should return 401 (no auth) or 200 (mocked auth)
			expect([200, 401].includes(response.status)).toBe(true);
		});
	});

	describe("GET /auth/me", () => {
		it("should return current user profile", async () => {
			const app = await createAuthApp();
			const response = await app.request("/auth/me");

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({
				data: {
					email: "test@test.com",
					id: "test-user",
					name: "Test User"
				},
				message: "User authenticated successfully"
			});
		});
	});
});
