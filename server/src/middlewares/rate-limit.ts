import type { MiddlewareHandler } from "hono";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import type { AppBindings } from "@/lib/types";

interface RateLimitOptions {
	keyPrefix: string;
	limit: number;
	message?: string;
	windowMs: number;
}

interface RateLimitBucket {
	count: number;
	resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();
const maxBuckets = 10_000;

const getClientIp = (headers: Headers) => {
	const forwardedFor = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	return headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? forwardedFor ?? "unknown";
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
};

export const createRateLimit = ({
	keyPrefix,
	limit,
	message = "Too many requests. Please wait and try again.",
	windowMs
}: RateLimitOptions): MiddlewareHandler<AppBindings> => {
	return async (c, next) => {
		const now = Date.now();
		pruneExpiredBuckets(now);

		const key = `${keyPrefix}:${getClientIp(c.req.raw.headers)}`;
		const existingBucket = buckets.get(key);
		const bucket =
			existingBucket && existingBucket.resetAt > now ? existingBucket : { count: 0, resetAt: now + windowMs };

		const remaining = Math.max(0, limit - bucket.count - 1);
		c.header("X-RateLimit-Limit", String(limit));
		c.header("X-RateLimit-Remaining", String(remaining));
		c.header("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

		if (bucket.count >= limit) {
			c.header("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
			buckets.set(key, bucket);
			return c.json({ message }, HttpStatusCodes.TOO_MANY_REQUESTS);
		}

		bucket.count += 1;
		buckets.set(key, bucket);
		await next();
	};
};

export const authRateLimit = createRateLimit({
	keyPrefix: "auth",
	limit: 20,
	message: "Too many authentication attempts. Please wait and try again.",
	windowMs: 60_000
});

export const aiRateLimit = createRateLimit({
	keyPrefix: "ai",
	limit: 60,
	message: "Too many AI requests. Please wait and try again.",
	windowMs: 60_000
});
