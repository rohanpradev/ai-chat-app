import { generateId } from "ai";
import { and, eq, gte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "@/db";
import { embeddingDocuments, usageEvents } from "@/db/schema";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import env from "@/utils/env";

export type UsageScope = "ai" | "embedding";

interface ReserveUsageInput {
	category: string;
	estimatedTokens: number;
	model?: string;
	requestId?: string;
	resourceBytes?: number;
	scope: UsageScope;
	userId: string;
}

interface SettleUsageInput {
	inputTokens?: number;
	outputTokens?: number;
	status?: "completed" | "failed";
	totalTokens?: number;
}

const startOfUtcDay = () => {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const activeReservationCutoff = () => new Date(Date.now() - 15 * 60 * 1000);

const asNumber = (value: unknown) => {
	const parsed = Number(value ?? 0);
	return Number.isFinite(parsed) ? parsed : 0;
};

const limitsFor = (scope: UsageScope) =>
	scope === "ai"
		? { requests: env.AI_DAILY_REQUEST_LIMIT, tokens: env.AI_DAILY_TOKEN_LIMIT }
		: { requests: Number.POSITIVE_INFINITY, tokens: env.EMBEDDING_DAILY_TOKEN_LIMIT };

export const estimateTokens = (value: unknown) => Math.max(1, Math.ceil(JSON.stringify(value).length / 4));

export const reserveUsage = async ({
	category,
	estimatedTokens,
	model,
	requestId = generateId(),
	resourceBytes = 0,
	scope,
	userId
}: ReserveUsageInput) => {
	const reservedTokens = Math.max(1, Math.ceil(estimatedTokens));
	const limits = limitsFor(scope);

	await db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`quota:${userId}:${scope}`}))`);
		const [totals] = await tx
			.select({
				requests: sql<number>`count(*)`,
				tokens: sql<number>`coalesce(sum(case when ${usageEvents.status} = 'reserved' and ${usageEvents.createdAt} >= ${activeReservationCutoff()} then ${usageEvents.reservedTokens} else ${usageEvents.totalTokens} end), 0)`
			})
			.from(usageEvents)
			.where(
				and(
					eq(usageEvents.userId, userId),
					eq(usageEvents.scope, scope),
					gte(usageEvents.createdAt, startOfUtcDay()),
					sql`${usageEvents.status} <> 'failed'`
				)
			);

		const requests = asNumber(totals?.requests);
		const tokens = asNumber(totals?.tokens);
		if (requests + 1 > limits.requests || tokens + reservedTokens > limits.tokens) {
			throw new HTTPException(HttpStatusCodes.TOO_MANY_REQUESTS, {
				message: `${scope === "ai" ? "AI" : "Embedding"} daily quota exceeded. Try again after 00:00 UTC.`
			});
		}
		if (scope === "embedding" && resourceBytes > 0) {
			const [stored] = await tx
				.select({ bytes: sql<number>`coalesce(sum(${embeddingDocuments.byteSize}), 0)` })
				.from(embeddingDocuments)
				.where(eq(embeddingDocuments.userId, userId));
			const [pending] = await tx
				.select({ bytes: sql<number>`coalesce(sum(${usageEvents.resourceBytes}), 0)` })
				.from(usageEvents)
				.where(
					and(
						eq(usageEvents.userId, userId),
						eq(usageEvents.scope, "embedding"),
						eq(usageEvents.status, "reserved"),
						gte(usageEvents.createdAt, activeReservationCutoff())
					)
				);
			if (asNumber(stored?.bytes) + asNumber(pending?.bytes) + resourceBytes > env.EMBEDDING_STORAGE_BYTE_LIMIT) {
				throw new HTTPException(HttpStatusCodes.TOO_MANY_REQUESTS, {
					message: "Embedding storage quota exceeded. Delete documents before uploading more."
				});
			}
		}

		await tx.insert(usageEvents).values({
			category,
			model,
			requestId,
			reservedTokens,
			resourceBytes,
			scope,
			userId
		});
	});

	return requestId;
};

export const settleUsage = async (requestId: string, usage: SettleUsageInput) => {
	const inputTokens = Math.max(0, Math.ceil(usage.inputTokens ?? 0));
	const outputTokens = Math.max(0, Math.ceil(usage.outputTokens ?? 0));
	const totalTokens = Math.max(0, Math.ceil(usage.totalTokens ?? inputTokens + outputTokens));

	await db
		.update(usageEvents)
		.set({
			inputTokens,
			outputTokens,
			status: usage.status ?? "completed",
			totalTokens,
			updatedAt: new Date()
		})
		.where(eq(usageEvents.requestId, requestId));
};

export const getUsageSummary = async (userId: string) => {
	const totals = await db
		.select({
			requests: sql<number>`count(*)`,
			scope: usageEvents.scope,
			tokens: sql<number>`coalesce(sum(case when ${usageEvents.status} = 'reserved' and ${usageEvents.createdAt} >= ${activeReservationCutoff()} then ${usageEvents.reservedTokens} else ${usageEvents.totalTokens} end), 0)`
		})
		.from(usageEvents)
		.where(
			and(
				eq(usageEvents.userId, userId),
				gte(usageEvents.createdAt, startOfUtcDay()),
				sql`${usageEvents.status} <> 'failed'`
			)
		)
		.groupBy(usageEvents.scope);
	const [storage] = await db
		.select({ bytes: sql<number>`coalesce(sum(${embeddingDocuments.byteSize}), 0)` })
		.from(embeddingDocuments)
		.where(eq(embeddingDocuments.userId, userId));
	const ai = totals.find((row) => row.scope === "ai");
	const embedding = totals.find((row) => row.scope === "embedding");
	const resetsAt = startOfUtcDay();
	resetsAt.setUTCDate(resetsAt.getUTCDate() + 1);

	return {
		ai: {
			requests: { limit: env.AI_DAILY_REQUEST_LIMIT, used: asNumber(ai?.requests) },
			tokens: { limit: env.AI_DAILY_TOKEN_LIMIT, used: asNumber(ai?.tokens) }
		},
		embedding: {
			storageBytes: { limit: env.EMBEDDING_STORAGE_BYTE_LIMIT, used: asNumber(storage?.bytes) },
			tokens: { limit: env.EMBEDDING_DAILY_TOKEN_LIMIT, used: asNumber(embedding?.tokens) }
		},
		resetsAt: resetsAt.toISOString()
	};
};
