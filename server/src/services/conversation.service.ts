import { coerceCompatibleMyUIMessages, type MyUIMessage } from "@chat-app/shared";
import type { UIMessage } from "ai";
import { and, eq, notInArray, sql } from "drizzle-orm";
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

export const mergeConversationMessages = <TMessage extends Pick<UIMessage, "id">>(
	storedMessages: readonly TMessage[],
	incomingMessages: readonly TMessage[]
): TMessage[] => {
	const mergedMessages = [...storedMessages];
	const messageIndexById = new Map(mergedMessages.map((message, index) => [message.id, index]));

	for (const message of incomingMessages) {
		const existingIndex = messageIndexById.get(message.id);

		if (existingIndex === undefined) {
			messageIndexById.set(message.id, mergedMessages.length);
			mergedMessages.push(message);
			continue;
		}

		mergedMessages[existingIndex] = message;
	}

	return mergedMessages;
};

type StoredMessage = typeof messages.$inferSelect;

const sameJson = (left: unknown, right: unknown) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const messageChanged = (stored: StoredMessage, incoming: UIMessage, order: number) =>
	stored.order !== order ||
	stored.role !== incoming.role ||
	!sameJson(stored.parts, incoming.parts) ||
	!sameJson(stored.metadata, incoming.metadata);

export const loadConversationMessages = async (chatId: string | undefined, userId: string): Promise<MyUIMessage[]> => {
	if (!chatId) {
		return [];
	}

	const chat = await db.query.chats.findFirst({
		where: eq(chats.id, chatId),
		with: {
			messages: {
				columns: {
					id: true,
					metadata: true,
					parts: true,
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

	return coerceCompatibleMyUIMessages(rawMessages);
};

export const saveConversation = async (chatId: string | undefined, uiMessages: UIMessage[], userId: string) => {
	if (!chatId) return;

	const firstUserMessage = uiMessages.find((m) => m.role === "user");
	const textPart = firstUserMessage?.parts?.find((p) => p.type === "text");
	const title = textPart?.text?.slice(0, 50) || "New Chat";
	const now = new Date();

	await db.transaction(async (tx) => {
		// Serialize writers for one conversation across all Kubernetes replicas.
		await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${chatId}))`);
		const existingChat = await tx.query.chats.findFirst({
			where: eq(chats.id, chatId)
		});

		if (existingChat) {
			assertChatOwner(existingChat, userId);

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

		const storedMessages = await tx.select().from(messages).where(eq(messages.chatId, chatId));
		const storedById = new Map(storedMessages.map((message) => [message.id, message]));
		const newMessages: Array<typeof messages.$inferInsert> = [];
		const changedMessages: Array<{ incoming: UIMessage; order: number; revision: number }> = [];

		for (const [order, incoming] of uiMessages.entries()) {
			const stored = storedById.get(incoming.id);
			if (!stored) {
				newMessages.push({
					chatId,
					createdAt: now,
					id: incoming.id,
					metadata: incoming.metadata ?? null,
					order,
					parts: incoming.parts,
					revision: 1,
					role: incoming.role,
					schemaVersion: MESSAGE_SCHEMA_VERSION
				});
				changedMessages.push({ incoming, order, revision: 1 });
				continue;
			}

			if (messageChanged(stored, incoming, order)) {
				changedMessages.push({ incoming, order, revision: stored.revision + 1 });
			}
		}

		if (newMessages.length > 0) {
			await tx.insert(messages).values(newMessages);
		}

		for (const changed of changedMessages) {
			if (changed.revision > 1) {
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
			await tx.insert(messageRevisions).values(
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
			);
		}

		const incomingIds = uiMessages.map((message) => message.id);
		if (storedMessages.length > 0 && incomingIds.length === 0) {
			await tx.delete(messages).where(eq(messages.chatId, chatId));
			return;
		}
		if (storedMessages.length > 0 && incomingIds.length > 0) {
			await tx.delete(messages).where(and(eq(messages.chatId, chatId), notInArray(messages.id, incomingIds)));
		}
	});
};
