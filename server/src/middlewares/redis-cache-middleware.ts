import { type RedisClient, redis } from "bun";
import type { Context, Next } from "hono";
import { createMiddleware } from "hono/factory";

export interface RedisCacheOptions {
	key?: string | ((c: Context) => string);
	ttl?: number;
	namespace?: string;
	skipCache?: (c: Context) => boolean;
	onlySuccessful?: boolean;
	redisClient?: RedisClient;
	headers?: {
		cacheHit?: string;
		cacheTtl?: string;
	};
}

export interface CacheEntry {
	body: string;
	headers: Record<string, string>;
	status: number;
	timestamp: number;
	ttl: number;
}

class HonoRedisCache {
	private client: typeof redis | RedisClient;

	constructor(customClient?: RedisClient) {
		this.client = customClient || redis;
	}

	private buildKey(key: string, namespace: string): string {
		return `${namespace}:${key}`;
	}

	private serialize<T>(value: T): string {
		return JSON.stringify(value);
	}

	private deserialize<T>(value: string): T | null {
		try {
			return JSON.parse(value);
		} catch {
			return null;
		}
	}

	async get<T>(key: string, namespace: string): Promise<T | null> {
		try {
			const redisKey = this.buildKey(key, namespace);
			const value = await this.client.get(redisKey);

			if (value === null) {
				return null;
			}

			return this.deserialize<T>(value);
		} catch {
			return null;
		}
	}

	async set<T>(key: string, value: T, ttl: number, namespace: string): Promise<boolean> {
		try {
			const redisKey = this.buildKey(key, namespace);
			const serializedValue = this.serialize(value);

			await this.client.set(redisKey, serializedValue);
			await this.client.expire(redisKey, ttl);

			return true;
		} catch {
			return false;
		}
	}

	async del(key: string, namespace: string): Promise<boolean> {
		try {
			const redisKey = this.buildKey(key, namespace);
			await this.client.del(redisKey);
			return true;
		} catch {
			return false;
		}
	}

	async exists(key: string, namespace: string): Promise<boolean> {
		try {
			const redisKey = this.buildKey(key, namespace);
			const result = await this.client.exists(redisKey);
			return Number(result) > 0;
		} catch {
			return false;
		}
	}

	async ttl(key: string, namespace: string): Promise<number> {
		try {
			const redisKey = this.buildKey(key, namespace);
			return await this.client.ttl(redisKey);
		} catch {
			return -1;
		}
	}
}

const cacheInstance = new HonoRedisCache();

function generateCacheKey(c: Context): string {
	const { pathname, search } = new URL(c.req.url);
	const method = c.req.method;

	const userId = c.get("user")?.id || "";
	const userPart = userId ? `user:${userId}:` : "";

	return `${userPart}${method}:${pathname}${search}`;
}

function shouldCacheResponse(status: number, onlySuccessful: boolean): boolean {
	if (!onlySuccessful) return true;
	return status >= 200 && status < 300;
}

export const redisCache = (options: RedisCacheOptions = {}) => {
	const {
		key,
		ttl = 300,
		namespace = "hono-cache",
		skipCache,
		onlySuccessful = true,
		redisClient,
		headers = {}
	} = options;

	const cacheHitHeader = headers.cacheHit || "X-Cache-Hit";
	const cacheTtlHeader = headers.cacheTtl || "X-Cache-TTL";

	const cache = redisClient ? new HonoRedisCache(redisClient) : cacheInstance;

	return createMiddleware(async (c: Context, next: Next) => {
		if (skipCache?.(c)) {
			c.header(cacheHitHeader, "SKIP");
			return next();
		}

		const cacheKey = typeof key === "function" ? key(c) : key || generateCacheKey(c);

		try {
			const cached = await cache.get<CacheEntry>(cacheKey, namespace);

			if (cached) {
				const remainingTtl = await cache.ttl(cacheKey, namespace);
				c.get("logger").info({ cacheKey, remainingTtl }, "Cache HIT - Retrieved from cache");

				c.header(cacheHitHeader, "HIT");
				c.header(cacheTtlHeader, remainingTtl.toString());

				Object.entries(cached.headers).forEach(([name, value]) => {
					c.header(name, value);
				});

				c.status(cached.status as any);
				return c.body(cached.body);
			}

			c.get("logger").info({ cacheKey }, "Cache MISS - Not found in cache");
			c.header(cacheHitHeader, "MISS");

			await next();

			const response = c.res;
			const status = response.status;

			if (shouldCacheResponse(status, onlySuccessful)) {
				try {
					const body = await response.clone().text();
					const responseHeaders: Record<string, string> = {};

					response.headers.forEach((value, name) => {
						if (!name.toLowerCase().startsWith("x-cache")) {
							responseHeaders[name] = value;
						}
					});

					const cacheEntry: CacheEntry = {
						body,
						headers: responseHeaders,
						status,
						timestamp: Date.now(),
						ttl
					};

					await cache.set(cacheKey, cacheEntry, ttl, namespace);
					c.header(cacheTtlHeader, ttl.toString());
				} catch {}
			}
		} catch {
			c.header(cacheHitHeader, "ERROR");
			return next();
		}
	});
};

export const invalidateCache = {
	async all(namespace = "hono-cache", redisClient?: RedisClient): Promise<number> {
		return this.byPattern("*", namespace, redisClient);
	},
	async byKey(key: string, namespace = "hono-cache", redisClient?: RedisClient): Promise<boolean> {
		const cache = redisClient ? new HonoRedisCache(redisClient) : cacheInstance;
		return cache.del(key, namespace);
	},

	async byPattern(pattern: string, namespace = "hono-cache", redisClient?: RedisClient): Promise<number> {
		const cache = redisClient ? new HonoRedisCache(redisClient) : cacheInstance;
		const client = (cache as any).client;

		try {
			const searchPattern = `${namespace}:${pattern}`;
			const keys = await client.keys(searchPattern);

			if (keys.length === 0) return 0;

			const result = await client.del(...keys);
			return result;
		} catch {
			return 0;
		}
	},

	async byUser(userId: string, namespace = "hono-cache", redisClient?: RedisClient): Promise<number> {
		return this.byPattern(`user:${userId}:*`, namespace, redisClient);
	}
};

export const cacheWithKey = (key: string, options: Omit<RedisCacheOptions, "key"> = {}) => {
	return redisCache({ ...options, key });
};

export const userCache = (keyPattern: string, options: Omit<RedisCacheOptions, "key"> = {}) => {
	return redisCache({
		...options,
		key: (c) => {
			const userId = c.get("user")?.id || "anonymous";
			return `user:${userId}:${keyPattern}`;
		}
	});
};

export const apiCache = (resource: string, options: Omit<RedisCacheOptions, "key"> = {}) => {
	return redisCache({
		...options,
		key: (c) => {
			const { pathname, search } = new URL(c.req.url);
			return `api:${resource}:${c.req.method}:${pathname}${search}`;
		}
	});
};

export { HonoRedisCache, cacheInstance };
