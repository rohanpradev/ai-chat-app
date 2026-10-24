import { coerceCompatibleMyUIMessages, type MyUIMessage } from "@chat-app/shared";
import { isToolUIPart, type UIMessage } from "ai";
import { and, eq, inArray, max, notInArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "@/db";
import { chats, messageRevisions, messages } from "@/db/schema";
import * as HttpStatusCodes from "@/lib/http-status-codes";

const MESSAGE_SCHEMA_VERSION = 1;
const uiMessageRoles = ["assistant", "system", "user"] as const satisfies readonly UIMessage["role"][];

const isUIMessageRole = (role: string): role is UIMessage["role"] => uiMessageRoles.includes(role as UIMessage["role"]);

const assertChatOwner = (chat: { userId: string } | undefined, userId: string) => {
	if (chat && chat.userId !== userId) {
		throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
			message: "Chat ID already exists under a different user"
		});
	}
};

const sameJson = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
const messageIdConflict = () =>
	new HTTPException(HttpStatusCodes.CONFLICT, {
		message: "Message IDs must belong to this conversation. Reload it before trying again."
	});

export const mergeConversationMessages = (
	storedMessages: readonly MyUIMessage[],
	incomingMessages: readonly MyUIMessage[]
): MyUIMessage[] => {
	const mergedMessages = [...storedMessages];
	const messageIndexById = new Map(mergedMessages.map((message, index) => [message.id, index]));

	for (const message of incomingMessages) {
		const existingIndex = messageIndexById.get(message.id);

		if (existingIndex === undefined) {
			messageIndexById.set(message.id, mergedMessages.length);
			mergedMessages.push(message);
			continue;
		}

		const stored = mergedMessages[existingIndex];
		if (stored?.role !== "assistant" || message.role !== "assistant") continue;
		const responses = message.parts.filter(isToolUIPart).filter((part) => part.state === "approval-responded");
		if (responses.length === 0) continue;
		if (stored.id !== storedMessages.at(-1)?.id || message.id !== incomingMessages.at(-1)?.id) {
			throw new HTTPException(HttpStatusCodes.CONFLICT, {
				message: "This tool approval is no longer current. Reload the conversation."
			});
		}
		const approvedParts = new Map<MyUIMessage["parts"][number], MyUIMessage["parts"][number]>();
		for (const response of responses) {
			const original = stored.parts.find(
				(part) => isToolUIPart(part) && part.type === response.type && part.toolCallId === response.toolCallId
			);
			if (!original || !isToolUIPart(original) || original.state !== "approval-requested") {
				throw new HTTPException(HttpStatusCodes.CONFLICT, {
					message: "This tool approval was already handled. Reload the conversation."
				});
			}
			if (
				original.approval.id !== response.approval.id ||
				original.approval.signature !== response.approval.signature ||
				!sameJson(original.input, response.input)
			) {
				throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
					message: "Tool approval does not match its original request"
				});
			}
			if (approvedParts.has(original)) {
				throw new HTTPException(HttpStatusCodes.BAD_REQUEST, { message: "Tool approval responses must be unique" });
			}
			approvedParts.set(original, {
				...original,
				approval: { ...original.approval, approved: response.approval.approved, reason: response.approval.reason },
				state: "approval-responded"
			});
		}
		// Only the approval decision comes from the client. Keep persisted text,
		// metadata, call input and completed tool results authoritative.
		mergedMessages[existingIndex] = {
			...stored,
			parts: stored.parts.map((part) => approvedParts.get(part) ?? part)
		};
	}

	return mergedMessages;
};

type StoredMessage = typeof messages.$inferSelect;
type MessageVersion = Pick<StoredMessage, "id" | "order" | "revision">;

interface ConversationSnapshot {
	messages: MyUIMessage[];
	version: string | null;
}

const conversationVersion = (chat: { createdAt: Date } | undefined, rows: readonly MessageVersion[]): string | null =>
	chat
		? JSON.stringify({
				createdAt: chat.createdAt.toISOString(),
				messages: [...rows]
					.sort((left, right) => left.order - right.order)
					.map(({ id, order, revision }) => [id, order, revision])
			})
		: null;

const messageChanged = (stored: StoredMessage, incoming: UIMessage, order: number) =>
	stored.order !== order ||
	stored.role !== incoming.role ||
	!sameJson(stored.parts, incoming.parts) ||
	!sameJson(stored.metadata, incoming.metadata);

export const loadConversationSnapshot = async (
	chatId: string | undefined,
	userId: string
): Promise<ConversationSnapshot> => {
	if (!chatId) {
		return { messages: [], version: null };
	}

	const chat = await db.query.chats.findFirst({
		where: { id: chatId },
		with: {
			messages: {
				columns: {
					id: true,
					metadata: true,
					order: true,
					parts: true,
					revision: true,
					role: true
				},
				orderBy: (message, { asc }) => [asc(message.order)]
			}
		}
	});

	assertChatOwner(chat, userId);

	const rawMessages = (chat?.messages ?? []).map((message) => ({
		id: message.id,
		metadata: message.metadata ?? undefined,
		parts: Array.isArray(message.parts) ? message.parts : [],
		role: isUIMessageRole(message.role) ? message.role : "user"
	}));

	return {
		messages: await coerceCompatibleMyUIMessages(rawMessages),
		version: conversationVersion(chat, chat?.messages ?? [])
	};
};

export const saveConversation = async (
	chatId: string,
	uiMessages: UIMessage[],
	userId: string,
	expectedVersion: string | null
) => {
	if (new Set(uiMessages.map((message) => message.id)).size !== uiMessages.length) {
		throw new HTTPException(HttpStatusCodes.BAD_REQUEST, { message: "Message IDs must be unique" });
	}

	const firstUserMessage = uiMessages.find((m) => m.role === "user");
	const textPart = firstUserMessage?.parts?.find((p) => p.type === "text");
	const title = textPart?.text?.slice(0, 50) || "New Chat";
	const now = new Date();

	return db.transaction(async (tx) => {
		// Serialize writers for one conversation across all Kubernetes replicas.
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${chatId}))`);
		const existingChat = await tx.query.chats.findFirst({
			where: { id: chatId }
		});
		assertChatOwner(existingChat, userId);
		const storedMessages = await tx.select().from(messages).where(eq(messages.chatId, chatId));
		// The lock serializes writes; the version also rejects snapshots prepared
		// before a newer request or a deletion. Never resurrect a deleted stream.
		if (conversationVersion(existingChat, storedMessages) !== expectedVersion) {
			throw new HTTPException(HttpStatusCodes.CONFLICT, {
				message: "This conversation changed while the response was running. Reload it before trying again."
			});
		}
		const storedById = new Map(storedMessages.map((message) => [message.id, message]));
		const introducedIds = uiMessages.filter((message) => !storedById.has(message.id)).map((message) => message.id);
		const historicalMessages =
			introducedIds.length > 0
				? await tx
						.select({
							chatId: messageRevisions.chatId,
							messageId: messageRevisions.messageId,
							revision: max(messageRevisions.revision)
						})
						.from(messageRevisions)
						.where(inArray(messageRevisions.messageId, introducedIds))
						.groupBy(messageRevisions.chatId, messageRevisions.messageId)
				: [];
		if (historicalMessages.some((message) => message.chatId !== chatId)) throw messageIdConflict();
		const previousRevisionById = new Map(historicalMessages.map((message) => [message.messageId, message.revision ?? 0]));

		if (existingChat) {
			await tx
				.update(chats)
				.set({
					updatedAt: now
				})
				.where(eq(chats.id, chatId));
		} else {
			await tx.insert(chats).values({
				createdAt: now,
				id: chatId,
				title,
				updatedAt: now,
				userId
			});
		}

		const newMessages: Array<typeof messages.$inferInsert> = [];
		const changedMessages: Array<{ incoming: UIMessage; order: number; revision: number }> = [];

		for (const [order, incoming] of uiMessages.entries()) {
			const stored = storedById.get(incoming.id);
			if (!stored) {
				// Regeneration may remove a projection without removing its immutable
				// history. Reintroduced IDs must continue that history's sequence.
				const revision = (previousRevisionById.get(incoming.id) ?? 0) + 1;
				newMessages.push({
					chatId,
					createdAt: now,
					id: incoming.id,
					metadata: incoming.metadata ?? null,
					order,
					parts: incoming.parts,
					revision,
					role: incoming.role,
					schemaVersion: MESSAGE_SCHEMA_VERSION
				});
				changedMessages.push({ incoming, order, revision });
				continue;
			}

			if (messageChanged(stored, incoming, order)) {
				changedMessages.push({ incoming, order, revision: stored.revision + 1 });
			}
		}

		if (newMessages.length > 0) {
			const inserted = await tx
				.insert(messages)
				.values(newMessages)
				.onConflictDoNothing({ target: messages.id })
				.returning({ id: messages.id });
			if (inserted.length !== newMessages.length) throw messageIdConflict();
		}

		for (const changed of changedMessages) {
			if (storedById.has(changed.incoming.id)) {
				await tx
					.update(messages)
					.set({
						metadata: changed.incoming.metadata ?? null,
						order: changed.order,
						parts: changed.incoming.parts,
						revision: changed.revision,
						role: changed.incoming.role,
						schemaVersion: MESSAGE_SCHEMA_VERSION
					})
					.where(eq(messages.id, changed.incoming.id));
			}
		}

		if (changedMessages.length > 0) {
			const appended = await tx
				.insert(messageRevisions)
				.values(
					changedMessages.map(({ incoming, order, revision }) => ({
						chatId,
						messageId: incoming.id,
						metadata: incoming.metadata ?? null,
						order,
						parts: incoming.parts,
						revision,
						role: incoming.role,
						schemaVersion: MESSAGE_SCHEMA_VERSION
					}))
				)
				.onConflictDoNothing({ target: [messageRevisions.messageId, messageRevisions.revision] })
				.returning({ id: messageRevisions.id });
			// Per-chat locks do not cover another chat concurrently claiming the
			// same global ID. Roll back the whole write if that claim won first.
			if (appended.length !== changedMessages.length) throw messageIdConflict();
		}

		const incomingIds = uiMessages.map((message) => message.id);
		if (storedMessages.length > 0 && incomingIds.length === 0) {
			await tx.delete(messages).where(eq(messages.chatId, chatId));
		}
		if (storedMessages.length > 0 && incomingIds.length > 0) {
			await tx.delete(messages).where(and(eq(messages.chatId, chatId), notInArray(messages.id, incomingIds)));
		}

		const changedById = new Map(changedMessages.map((message) => [message.incoming.id, message.revision]));
		return conversationVersion(
			existingChat ?? { createdAt: now },
			uiMessages.map((message, order) => ({
				id: message.id,
				order,
				revision: changedById.get(message.id) ?? storedById.get(message.id)?.revision ?? 1
			}))
		);
	});
};

export const deleteStoredConversation = async (chatId: string, userId: string) =>
	db.transaction(async (tx) => {
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${chatId}))`);
		const [deletedChat] = await tx
			.delete(chats)
			.where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
			.returning({ id: chats.id });
		return deletedChat;
	});
