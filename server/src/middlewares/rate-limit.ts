import { redis } from "bun";
import type { MiddlewareHandler } from "hono";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import type { AppBindings } from "@/lib/types";

export interface RedisRateLimitClient {
	send(command: string, args: string[]): Promise<unknown>;
}

interface RateLimitOptions {
	keyPrefix: string;
	limit: number;
	message?: string;
	now?: () => number;
	redisClient?: RedisRateLimitClient;
	redisTimeoutMs?: number;
	windowMs: number;
}

interface RateLimitBucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();
const maxBuckets = 10_000;

const REDIS_RATE_LIMIT_SCRIPT = [
	"local count = redis.call('INCR', KEYS[1])",
	"if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
	"local ttl = redis.call('PTTL', KEYS[1])",
	"return { count, ttl }"
].join("\n");

const DEFAULT_REDIS_TIMEOUT_MS = 250;

const getRateLimitIdentity = (c: Parameters<MiddlewareHandler<AppBindings>>[0]) => {
	const userId = c.get("user")?.id ?? c.get("jwtPayload")?.sub.id ?? c.get("session")?.userId;
	return userId ? `user:${userId}` : "unauthenticated";
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
	let timeout: ReturnType<typeof setTimeout> | undefined;

	try {
		return await Promise.race([
			promise,
			new Promise<never>((_, reject) => {
				timeout = setTimeout(() => reject(new Error("Redis rate-limit command timed out")), timeoutMs);
			})
		]);
	} finally {
		if (timeout) {
			clearTimeout(timeout);
		}
	}
};

const parseRedisBucket = (result: unknown, now: number, resetAt: number): RateLimitBucket => {
	if (!Array.isArray(result) || result.length < 2) {
		throw new Error("Redis returned an invalid rate-limit result");
	}

	const count = Number(result[0]);
	const ttlMs = Number(result[1]);
	if (!Number.isInteger(count) || count < 1 || !Number.isFinite(ttlMs)) {
		throw new Error("Redis returned an invalid rate-limit bucket");
	}

	return {
		count,
		resetAt: ttlMs > 0 ? now + ttlMs : resetAt
	};
};

const pruneExpiredBuckets = (now: number) => {
	if (buckets.size < maxBuckets) {
		return;
	}

	for (const [key, bucket] of buckets) {
		if (bucket.resetAt <= now) {
			buckets.delete(key);
		}
	}

	while (buckets.size >= maxBuckets) {
		const oldestKey = buckets.keys().next().value;
		if (typeof oldestKey !== "string") {
			break;
		}
		buckets.delete(oldestKey);
	}
};

const consumeMemoryBucket = (key: string, now: number, resetAt: number): RateLimitBucket => {
	pruneExpiredBuckets(now);

	const existingBucket = buckets.get(key);
	const bucket = existingBucket && existingBucket.resetAt > now ? existingBucket : { count: 0, resetAt };
	bucket.count += 1;
	buckets.set(key, bucket);

	return bucket;
};

const setRateLimitHeaders = (
	c: Parameters<MiddlewareHandler<AppBindings>>[0],
	{ count, resetAt }: RateLimitBucket,
	limit: number,
	now: number,
	windowMs: number
) => {
	const remaining = Math.max(0, limit - count);
	const resetSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
	const resetEpochSeconds = Math.ceil(resetAt / 1000);

	c.header("RateLimit-Limit", String(limit));
	c.header("RateLimit-Remaining", String(remaining));
	c.header("RateLimit-Reset", String(resetSeconds));
	c.header("RateLimit-Policy", `${limit};w=${Math.ceil(windowMs / 1000)}`);
	c.header("X-RateLimit-Limit", String(limit));
	c.header("X-RateLimit-Remaining", String(remaining));
	c.header("X-RateLimit-Reset", String(resetEpochSeconds));

	return resetSeconds;
};

export const createRateLimit = ({
	keyPrefix,
	limit,
	message = "Too many requests. Please wait and try again.",
	now: getNow = Date.now,
	redisClient = redis,
	redisTimeoutMs = DEFAULT_REDIS_TIMEOUT_MS,
	windowMs
}: RateLimitOptions): MiddlewareHandler<AppBindings> => {
	let useMemoryUntil = 0;

	return async (c, next) => {
		const now = getNow();
		const windowIndex = Math.floor(now / windowMs);
		const resetAt = (windowIndex + 1) * windowMs;
		const identity = getRateLimitIdentity(c);
		const key = `rate-limit:v1:${keyPrefix}:${encodeURIComponent(identity)}:${windowIndex}`;
		let bucket: RateLimitBucket;

		if (now < useMemoryUntil) {
			bucket = consumeMemoryBucket(key, now, resetAt);
		} else {
			try {
				const result = await withTimeout(
					redisClient.send("EVAL", [REDIS_RATE_LIMIT_SCRIPT, "1", key, String(Math.max(1, resetAt - now))]),
					redisTimeoutMs
				);
				bucket = parseRedisBucket(result, now, resetAt);
			} catch (error) {
				useMemoryUntil = resetAt;
				c.get("logger")?.warn({ err: error, keyPrefix }, "Redis rate limiter unavailable; using bounded local fallback");
				bucket = consumeMemoryBucket(key, now, resetAt);
			}
		}

		const resetSeconds = setRateLimitHeaders(c, bucket, limit, now, windowMs);

		if (bucket.count > limit) {
			c.header("Retry-After", String(resetSeconds));
			return c.json({ message }, HttpStatusCodes.TOO_MANY_REQUESTS);
		}

		await next();
	};
};

export const aiRateLimit = createRateLimit({
	keyPrefix: "ai",
	limit: 60,
	message: "Too many AI requests. Please wait and try again.",
	windowMs: 60_000
});

export const embeddingIngestRateLimit = createRateLimit({
	keyPrefix: "embedding-ingest",
	limit: 6,
	message: "Too many embedding ingestion requests. Please wait and try again.",
	windowMs: 60_000
});

export const embeddingSearchRateLimit = createRateLimit({
	keyPrefix: "embedding-search",
	limit: 60,
	message: "Too many embedding search requests. Please wait and try again.",
	windowMs: 60_000
});

export const embeddingRagRateLimit = createRateLimit({
	keyPrefix: "embedding-rag",
	limit: 20,
	message: "Too many RAG requests. Please wait and try again.",
	windowMs: 60_000
});
