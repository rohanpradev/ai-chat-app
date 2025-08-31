import type { UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "@/db";
import { chats, messages } from "@/db/schema";

export const saveConversation = async (chatId: string | undefined, uiMessages: UIMessage[], userId: string) => {
	if (!chatId) return;

	const firstUserMessage = uiMessages.find((m) => m.role === "user");
	const textPart = firstUserMessage?.parts?.find((p) => p.type === "text");
	const title = textPart?.text?.slice(0, 50) || "New Chat";

	const existingChat = await db.query.chats.findFirst({
		where: eq(chats.id, chatId)
	});

	if (existingChat) {
		// If chat exists but belongs to a different user, throw error
		if (existingChat.userId !== userId) {
			throw new HTTPException(HttpStatusCodes.FORBIDDEN, { message: "Chat ID already exists under a different user" });
		}
		// Delete all existing messages
		await db.delete(messages).where(eq(messages.chatId, chatId));
	} else {
		// Create new chat
		await db.insert(chats).values({
			id: chatId,
			title,
			userId: userId
		});
	}

	// Insert all messages
	await db.insert(messages).values(
		uiMessages.map((message, index) => ({
			chatId,
			id: Bun.randomUUIDv7(),
			order: index,
			parts: message.parts,
			role: message.role
		}))
	);
};
