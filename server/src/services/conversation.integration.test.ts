import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import type { MyUIMessage } from "@chat-app/shared";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "@/db";
import { messageRevisions, users } from "@/db/schema";
import { deleteStoredConversation, loadConversationSnapshot, saveConversation } from "@/services/conversation.service";

// Run against a disposable, migrated PostgreSQL database with RUN_DATABASE_TESTS=1.
// These tests exercise the real transaction locks, foreign keys and revision history.
describe.skipIf(Bun.env.RUN_DATABASE_TESTS !== "1")("conversation persistence on PostgreSQL", () => {
	let userId: string;
	let chatId: string;
	const message = (text: string, role: MyUIMessage["role"] = "user"): MyUIMessage => ({
		id: crypto.randomUUID(),
		parts: [{ text, type: "text" }],
		role
	});

	beforeEach(async () => {
		userId = crypto.randomUUID();
		chatId = `integration-${crypto.randomUUID()}`;
		await db.insert(users).values({ email: `${userId}@integration.invalid`, id: userId, name: "Database regression" });
	});

	afterEach(async () => {
		await db.delete(users).where(eq(users.id, userId));
	});

	it("accepts exactly one of two writers based on the same snapshot", async () => {
		const prompt = message("Original question");
		const initialVersion = await saveConversation(chatId, [prompt], userId, null);
		const variants = [
			[prompt, message("First tab")],
			[prompt, message("Second tab")]
		];
		const results = await Promise.allSettled(
			variants.map((history) => saveConversation(chatId, history, userId, initialVersion))
		);
		const fulfilled = results.filter((result) => result.status === "fulfilled");
		const rejected = results.filter((result) => result.status === "rejected");

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect(rejected[0]?.reason).toBeInstanceOf(HTTPException);
		expect(rejected[0]?.reason.status).toBe(409);
		const winner = results.findIndex((result) => result.status === "fulfilled");
		const winningHistory = variants[winner];
		if (!winningHistory) throw new Error("Expected one committed history");
		expect((await loadConversationSnapshot(chatId, userId)).messages).toEqual(winningHistory);
	});

	it("preserves the newer turn when an earlier stream finishes late", async () => {
		const firstPrompt = message("First turn");
		const earlierVersion = await saveConversation(chatId, [firstPrompt], userId, null);
		const laterPrompt = message("Newer turn");
		const laterVersion = await saveConversation(chatId, [firstPrompt, laterPrompt], userId, earlierVersion);

		await expect(
			saveConversation(chatId, [firstPrompt, message("Late answer", "assistant")], userId, earlierVersion)
		).rejects.toMatchObject({ status: 409 });
		expect((await loadConversationSnapshot(chatId, userId)).messages).toEqual([firstPrompt, laterPrompt]);
		const laterReply = message("Current answer", "assistant");
		await saveConversation(chatId, [firstPrompt, laterPrompt, laterReply], userId, laterVersion);
		expect((await loadConversationSnapshot(chatId, userId)).messages).toEqual([firstPrompt, laterPrompt, laterReply]);
	});

	it("does not resurrect a deleted conversation when its stream finishes", async () => {
		const prompt = message("Delete during generation");
		const version = await saveConversation(chatId, [prompt], userId, null);
		expect(await deleteStoredConversation(chatId, userId)).toEqual({ id: chatId });
		await expect(
			saveConversation(chatId, [prompt, message("Late answer", "assistant")], userId, version)
		).rejects.toMatchObject({ status: 409 });
		expect(await loadConversationSnapshot(chatId, userId)).toEqual({ messages: [], version: null });
	});

	it("keeps deletion final when it races an accepted stream completion", async () => {
		const prompt = message("Concurrent deletion");
		const version = await saveConversation(chatId, [prompt], userId, null);
		const results = await Promise.allSettled([
			saveConversation(chatId, [prompt, message("Answer", "assistant")], userId, version),
			deleteStoredConversation(chatId, userId)
		]);
		expect(results[1]).toMatchObject({ status: "fulfilled", value: { id: chatId } });
		if (results[0]?.status === "rejected") expect(results[0].reason).toMatchObject({ status: 409 });
		expect(await loadConversationSnapshot(chatId, userId)).toEqual({ messages: [], version: null });
	});

	it("preserves immutable revisions during regeneration", async () => {
		const prompt = message("Question");
		const reply = message("Original answer", "assistant");
		const version = await saveConversation(chatId, [prompt, reply], userId, null);
		const replacement: MyUIMessage = { ...reply, parts: [{ text: "Regenerated answer", type: "text" }] };
		await saveConversation(chatId, [prompt, replacement], userId, version);
		const revisions = await db
			.select()
			.from(messageRevisions)
			.where(and(eq(messageRevisions.chatId, chatId), eq(messageRevisions.messageId, reply.id)))
			.orderBy(messageRevisions.revision);

		expect(revisions.map((revision) => ({ parts: revision.parts, revision: revision.revision }))).toEqual([
			{ parts: reply.parts, revision: 1 },
			{ parts: replacement.parts, revision: 2 }
		]);
		expect((await loadConversationSnapshot(chatId, userId)).messages).toEqual([prompt, replacement]);
	});

	it("allocates monotonic revisions when regeneration removed a message that is later reintroduced", async () => {
		const prompt = message("Question");
		const reply = message("Original answer", "assistant");
		let version = await saveConversation(chatId, [prompt, reply], userId, null);
		version = await saveConversation(chatId, [prompt], userId, version);
		const restored: MyUIMessage = { ...reply, parts: [{ text: "Restored answer", type: "text" }] };
		version = await saveConversation(chatId, [prompt, restored], userId, version);
		version = await saveConversation(chatId, [prompt], userId, version);
		await saveConversation(chatId, [prompt, reply], userId, version);
		const revisions = await db
			.select()
			.from(messageRevisions)
			.where(and(eq(messageRevisions.chatId, chatId), eq(messageRevisions.messageId, reply.id)))
			.orderBy(messageRevisions.revision);
		expect(revisions.map((revision) => ({ parts: revision.parts, revision: revision.revision }))).toEqual([
			{ parts: reply.parts, revision: 1 },
			{ parts: restored.parts, revision: 2 },
			{ parts: reply.parts, revision: 3 }
		]);
		expect((await loadConversationSnapshot(chatId, userId)).messages).toEqual([prompt, reply]);
	});

	it("rejects another conversation's historical message ID without allocating or changing its revisions", async () => {
		const prompt = message("Private history");
		let version = await saveConversation(chatId, [prompt], userId, null);
		version = await saveConversation(chatId, [], userId, version);
		const otherUser = crypto.randomUUID();
		const otherChat = `integration-${crypto.randomUUID()}`;
		await db.insert(users).values({ email: `${otherUser}@integration.invalid`, id: otherUser, name: "Other owner" });
		try {
			await expect(
				saveConversation(otherChat, [{ ...prompt, parts: [{ text: "Attempted reuse", type: "text" }] }], otherUser, null)
			).rejects.toMatchObject({ status: 409 });
			expect(await loadConversationSnapshot(otherChat, otherUser)).toEqual({ messages: [], version: null });
			const revisions = await db.select().from(messageRevisions).where(eq(messageRevisions.messageId, prompt.id));
			expect(
				revisions.map((revision) => ({ chatId: revision.chatId, parts: revision.parts, revision: revision.revision }))
			).toEqual([{ chatId, parts: prompt.parts, revision: 1 }]);
			expect((await loadConversationSnapshot(chatId, userId)).version).toBe(version);
		} finally {
			await db.delete(users).where(eq(users.id, otherUser));
		}
	});

	it("allows only one owner to claim the same new global message ID concurrently", async () => {
		const shared = message("Globally unique message");
		const otherUser = crypto.randomUUID();
		const otherChat = `integration-${crypto.randomUUID()}`;
		await db.insert(users).values({ email: `${otherUser}@integration.invalid`, id: otherUser, name: "Other owner" });
		try {
			const results = await Promise.allSettled([
				saveConversation(chatId, [shared], userId, null),
				saveConversation(otherChat, [shared], otherUser, null)
			]);
			expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
			const rejected = results.filter((result) => result.status === "rejected");
			expect(rejected).toHaveLength(1);
			expect(rejected[0]?.reason).toMatchObject({ status: 409 });
			const winnerChat = results[0]?.status === "fulfilled" ? chatId : otherChat;
			const revisions = await db.select().from(messageRevisions).where(eq(messageRevisions.messageId, shared.id));
			expect(revisions.map((revision) => ({ chatId: revision.chatId, revision: revision.revision }))).toEqual([
				{ chatId: winnerChat, revision: 1 }
			]);
		} finally {
			await db.delete(users).where(eq(users.id, otherUser));
		}
	});

	it("rejects another user's writes and deletion without changing the owner history", async () => {
		const prompt = message("Private conversation");
		const version = await saveConversation(chatId, [prompt], userId, null);
		const otherUser = crypto.randomUUID();
		await expect(loadConversationSnapshot(chatId, otherUser)).rejects.toMatchObject({ status: 403 });
		await expect(saveConversation(chatId, [message("Overwrite")], otherUser, version)).rejects.toMatchObject({
			status: 403
		});
		expect(await deleteStoredConversation(chatId, otherUser)).toBeUndefined();
		expect((await loadConversationSnapshot(chatId, userId)).messages).toEqual([prompt]);
	});
});
