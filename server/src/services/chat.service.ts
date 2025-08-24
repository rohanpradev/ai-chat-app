import type { MyUIMessage } from "@chat-app/shared";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chats, messages } from "@/db/schema";

export const upsertChat = async (opts: { userId: string; chatId: string; title: string; messages: MyUIMessage[] }) => {
	const { userId, chatId, title, messages: newMessages } = opts;

	// First, check if the chat exists and belongs to the user
	const existingChat = await db.query.chats.findFirst({
		where: ({ id }, { eq }) => eq(id, chatId)
	});

	if (existingChat) {
		// If chat exists but belongs to a different user, throw error
		if (existingChat.userId !== userId) {
			throw new Error("Chat ID already exists under a different user");
		}
		// Delete all existing messages
		await db.delete(messages).where(eq(messages.chatId, chatId));
	} else {
		// Create new chat
		await db.insert(chats).values({
			id: chatId,
			title,
			userId
		});
	}

	// Insert all messages
	await db.insert(messages).values(
		newMessages.map((message, index) => ({
			chatId,
			id: Bun.randomUUIDv7(),
			order: index,
			parts: message.parts,
			role: message.role
		}))
	);

	return { id: chatId };
};

export const getChat = async (opts: { userId: string; chatId: string }) => {
	const { userId, chatId } = opts;

	const chat = await db.query.chats.findFirst({
		where: and(eq(chats.id, chatId), eq(chats.userId, userId)),
		with: {
			messages: {
				columns: { id: true, parts: true, role: true },
				orderBy: (messages, { asc }) => [asc(messages.order)]
			}
		}
	});
	return chat;
};

export const getChats = async (opts: { userId: string }) => {
	const { userId } = opts;

	return await db.query.chats.findMany({
		orderBy: (chats, { desc }) => [desc(chats.updatedAt)],
		where: eq(chats.userId, userId)
	});
};
