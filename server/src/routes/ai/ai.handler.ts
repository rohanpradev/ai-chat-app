import { getAvailableTools } from "@/lib/tools";
import type { AppRouteHandler } from "@/lib/types";
import type { AIStreamRoute } from "@/routes/ai/ai.route";
import { saveConversation } from "@/services/conversation.service";
import { MODELS, transformPrompt } from "@/utils/index";
import { createIdGenerator, smoothStream, streamText, validateUIMessages } from "ai";

export const aiStream: AppRouteHandler<AIStreamRoute> = async (c) => {
	const requestBody = c.req.valid("json");
	const coalescedChatId = requestBody.chatId || requestBody.id || requestBody.conversationId;
	const { messages: uiMessages, model = "gpt-5-mini", tools: toolNames = [] } = requestBody;

	const selectedTools = getAvailableTools(toolNames);

	const validatedMessages = await validateUIMessages({
		messages: uiMessages as any,
		tools: selectedTools as any
	});

	const messages = transformPrompt(validatedMessages);
	const userJwt = c.get("jwtPayload").sub;

	const result = streamText({
		experimental_telemetry: {
			isEnabled: true,
			functionId: "ai-stream-chat",
			metadata: {
				userId: userJwt.id,
				...(coalescedChatId && { sessionId: coalescedChatId }),
				model,
				tags: ["chat", "stream", model],
				toolCount: toolNames.length,
				...(toolNames.length > 0 && { tools: toolNames.join(",") })
			}
		},
		experimental_transform: smoothStream(),
		messages,
		model: MODELS.azureOpenAI(model),
		tools: selectedTools as any
	});

	return result.toUIMessageStreamResponse({
		generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
		onFinish: async ({ messages: finalMessages }) => {
			await saveConversation(coalescedChatId, finalMessages, userJwt.id);
		},
		originalMessages: uiMessages as any,
		sendReasoning: true,
		sendSources: true
	});
};