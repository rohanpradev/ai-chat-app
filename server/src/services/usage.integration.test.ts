import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { usageEvents, users } from "@/db/schema";
import { getUsageSummary, reserveUsage, settleUsage } from "@/services/usage.service";
import env from "@/utils/env";

describe.skipIf(Bun.env.RUN_DATABASE_TESTS !== "1")("usage accounting on PostgreSQL", () => {
	let userId: string;
	const reserve = (estimatedTokens = 100) =>
		reserveUsage({
			category: "integration-test",
			estimatedTokens,
			scope: "ai",
			userId
		});

	beforeEach(async () => {
		userId = crypto.randomUUID();
		await db.insert(users).values({ email: `${userId}@integration.invalid`, id: userId, name: "Quota regression" });
	});

	afterEach(async () => {
		await db.delete(users).where(eq(users.id, userId));
	});

	it("charges measured usage from a failed multi-step stream and rejects excess quota", async () => {
		const requestId = await reserve();
		await settleUsage(requestId, { inputTokens: 30, outputTokens: 20, status: "failed", totalTokens: 50 });
		const usage = await getUsageSummary(userId);
		expect(usage.ai.requests.used).toBe(1);
		expect(usage.ai.tokens.used).toBe(50);
		await expect(reserve(env.AI_DAILY_TOKEN_LIMIT - 49)).rejects.toMatchObject({ status: 429 });
	});

	it("releases reservations that failed before consuming any provider tokens", async () => {
		const requestId = await reserve();
		await settleUsage(requestId, { status: "failed" });
		const usage = await getUsageSummary(userId);
		expect(usage.ai.requests.used).toBe(0);
		expect(usage.ai.tokens.used).toBe(0);
		await expect(reserve(env.AI_DAILY_TOKEN_LIMIT)).resolves.toBeString();
	});

	it("does not erase consumed tokens when error cleanup settles a request again", async () => {
		const requestId = await reserve();
		await settleUsage(requestId, { inputTokens: 30, outputTokens: 20, totalTokens: 50 });
		await settleUsage(requestId, { status: "failed" });
		const usage = await getUsageSummary(userId);
		expect(usage.ai.requests.used).toBe(1);
		expect(usage.ai.tokens.used).toBe(50);
	});

	it("serializes concurrent quota reservations across database connections", async () => {
		const amount = Math.floor(env.AI_DAILY_TOKEN_LIMIT / 2) + 1;
		const results = await Promise.allSettled([reserve(amount), reserve(amount)]);
		expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
		const rejected = results.filter((result) => result.status === "rejected");
		expect(rejected).toHaveLength(1);
		expect(rejected[0]?.reason).toMatchObject({ status: 429 });
	});

	it("expires abandoned reservations without dropping measured failed usage", async () => {
		await db.insert(usageEvents).values({
			category: "integration-test",
			createdAt: new Date(Date.now() - 16 * 60 * 1000),
			requestId: crypto.randomUUID(),
			reservedTokens: 500,
			scope: "ai",
			status: "reserved",
			userId
		});
		const requestId = await reserve();
		await settleUsage(requestId, { inputTokens: 30, outputTokens: 20, status: "failed" });
		expect((await getUsageSummary(userId)).ai.tokens.used).toBe(50);
	});
});
