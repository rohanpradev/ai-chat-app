import type { UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "@/db";
import { chats, messages } from "@/db/schema";
import * as HttpStatusCodes from "@/lib/http-status-codes";

const MESSAGE_SCHEMA_VERSION = 1;

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

export const loadConversationMessages = async (chatId: string | undefined, userId: string): Promise<UIMessage[]> => {
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

	return (chat?.messages ?? []).map((message) => ({
		id: message.id,
		metadata: message.metadata ?? undefined,
		parts: Array.isArray(message.parts) ? message.parts : [],
		role: message.role as UIMessage["role"]
	}));
};

export const saveConversation = async (chatId: string | undefined, uiMessages: UIMessage[], userId: string) => {
	if (!chatId) return;

	const firstUserMessage = uiMessages.find((m) => m.role === "user");
	const textPart = firstUserMessage?.parts?.find((p) => p.type === "text");
	const title = textPart?.text?.slice(0, 50) || "New Chat";
	const now = new Date();

	await db.transaction(async (tx) => {
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

			await tx.delete(messages).where(eq(messages.chatId, chatId));
		} else {
			await tx.insert(chats).values({
				createdAt: now,
				id: chatId,
				title,
				updatedAt: now,
				userId
			});
		}

		if (uiMessages.length === 0) {
			return;
		}

		await tx.insert(messages).values(
			uiMessages.map((message, index) => ({
				chatId,
				createdAt: now,
				id: message.id,
				metadata: message.metadata ?? null,
				order: index,
				parts: message.parts,
				role: message.role,
				schemaVersion: MESSAGE_SCHEMA_VERSION
			}))
		);
	});
};
