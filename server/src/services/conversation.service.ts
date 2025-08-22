import type { UIMessage } from "ai";
import { db } from "@/db";
import { aiConversations } from "@/db/schema";

export const saveConversation = async (chatId: string | undefined, messages: UIMessage[], userId: string) => {
	if (!chatId) return;

	const firstUserMessage = messages.find((m) => m.role === "user");
	const textPart = firstUserMessage?.parts?.find((p) => p.type === "text");
	const title = textPart?.text?.slice(0, 50) || "New Chat";

	return db
		.insert(aiConversations)
		.values({
			id: chatId,
			messages: messages as any,
			title,
			userId
		})
		.onConflictDoUpdate({
			set: {
				messages: messages as any,
				title,
				updatedAt: new Date()
			},
			target: aiConversations.id
		});
};
