import type { UIMessage } from "ai";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { db } from "@/db";
import { chats, messages } from "@/db/schema";
import * as HttpStatusCodes from "@/lib/http-status-codes";

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
			if (existingChat.userId !== userId) {
				throw new HTTPException(HttpStatusCodes.FORBIDDEN, {
					message: "Chat ID already exists under a different user"
				});
			}

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
				id: Bun.randomUUIDv7(),
				order: index,
				parts: message.parts,
				role: message.role
			}))
		);
	});
};
