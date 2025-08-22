import { createIdGenerator, smoothStream, streamText } from "ai";
import { getAvailableTools } from "@/lib/tools";
import type { AppRouteHandler } from "@/lib/types";
import type { AIStreamRoute } from "@/routes/ai/ai.route";
import { saveConversation } from "@/services/conversation.service";
import { MODELS, transformPrompt } from "@/utils/index";

export const aiStream: AppRouteHandler<AIStreamRoute> = async (c) => {
	const requestBody = c.req.valid("json");
	// Coalesce potential aliases from client (chatId | id | conversationId)
	const coalescedChatId = requestBody.chatId || requestBody.id || requestBody.conversationId;
	const { messages: uiMessages, model = "gpt-5-mini", tools: toolNames = [] } = requestBody;

	const selectedTools = getAvailableTools(toolNames);
	// The request schema validates the shape, but the AI SDK types are broader.
	// Cast to align with convertToModelMessages input expectations.
	const messages = transformPrompt(uiMessages as any);

	const userJwt = c.get("jwtPayload").sub;

	const result = streamText({
		experimental_transform: smoothStream(),
		messages,
		model: MODELS.azureOpenAI(model),
		// model: MODELS.openAI(model),
		tools: selectedTools
	});

	return result.toUIMessageStreamResponse({
		// Generate consistent server-side IDs for AI messages
		generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
		onFinish: async ({ messages: finalMessages }) => {
			await saveConversation(coalescedChatId, finalMessages, userJwt.id);
		},
		originalMessages: uiMessages as any,
		sendReasoning: true,
		sendSources: true
	});
};
