import { convertToModelMessages, smoothStream, streamText } from "ai";
import { HTTPException } from "hono/http-exception";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { db } from "@/db";
import { getAvailableTools } from "@/lib/tools";
import type { AppRouteHandler } from "@/lib/types";
import type { AIStreamRoute } from "@/routes/ai/ai.route";
import { upsertChat } from "@/services/chat.service";
import { MODELS } from "@/utils/index";

export const aiStream: AppRouteHandler<AIStreamRoute> = async (c) => {
	const { chatId, messages: uiMessages, model = "gpt-5-mini", tools: toolNames = [] } = c.req.valid("json");

	const selectedTools = getAvailableTools(toolNames);
	const messages = convertToModelMessages(uiMessages as any);

	const userJwt = c.get("jwtPayload").sub;

	let currentChatId = chatId;
	if (!currentChatId) {
		currentChatId = Bun.randomUUIDv7();
	}

	// Verify chat belongs to user if chatId provided and chat exists
	if (chatId) {
		const chat = await db.query.chats.findFirst({
			where: ({ id }, { eq }) => eq(id, chatId)
		});
		// Only check authorization if chat exists (allow new chats to be created)
		if (chat && chat.userId !== userJwt.id) {
			throw new HTTPException(HttpStatusCodes.FORBIDDEN, { message: "Unauthorized access to chat" });
		}
	}

	const result = streamText({
		experimental_transform: smoothStream(),
		messages,
		model: MODELS.azureOpenAI(model),
		tools: selectedTools
	});

	return result.toUIMessageStreamResponse({
		messageMetadata: ({ part }) => {
			if (part.type === "finish" && !chatId) {
				return { chatId: currentChatId };
			}
		},
		onError: (error) => {
			c.get("logger").error("AI Stream Error:", error);
			return "An error occurred while processing your request";
		},
		onFinish: async ({ messages: finalMessages }) => {
			const firstUserMessage = finalMessages.find((m) => m.role === "user");
			const textPart = firstUserMessage?.parts?.find((p) => p.type === "text");
			const title = `${textPart?.text?.slice(0, 50) || "New Chat"}...`;
			try {
				await upsertChat({
					chatId: currentChatId,
					messages: finalMessages as any,
					title,
					userId: userJwt.id
				});
			} catch (error) {
				c.get("logger").error(`Failed to save chat: ${currentChatId}`, error);
			}
		},
		originalMessages: uiMessages as any,
		sendReasoning: true,
		sendSources: true
	});
};
