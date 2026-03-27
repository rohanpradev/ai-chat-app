import { ChatRequestSchema, defaultModelId, type MyUIMessage, safeValidateMyUIMessages } from "@chat-app/shared";
import { propagateAttributes } from "@langfuse/tracing";
import { consumeStream, convertToModelMessages, createIdGenerator, smoothStream } from "ai";
import { HTTPException } from "hono/http-exception";
import { normalizeMessagesForAgent } from "@/lib/agent-message-normalizer";
import { getChatAgent, resolveAgentMode } from "@/lib/agents";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import type { AIStreamRoute, GetAvailableModelsRoute } from "@/routes/ai/ai.route";
import { saveConversation } from "@/services/conversation.service";
import { getAvailableChatModels } from "@/services/model-catalog.service";

export const getAvailableModels: AppRouteHandler<GetAvailableModelsRoute> = async (c) => {
	const availableModels = await getAvailableChatModels();

	return c.json({
		data: availableModels,
		message: "Available AI models retrieved successfully"
	});
};

export const aiStream: AppRouteHandler<AIStreamRoute> = async (c) => {
	const requestBody = ChatRequestSchema.parse(await c.req.json());
	const coalescedChatId = requestBody.chatId || requestBody.id || requestBody.conversationId;
	const { agentMode, model = defaultModelId, tools: toolNames = [] } = requestBody;
	const uiMessages = requestBody.messages;
	const validation = await safeValidateMyUIMessages(uiMessages);

	if (!validation.success) {
		throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
			message: `Invalid UI messages payload: ${validation.error.message}`
		});
	}

	const validatedMessages = validation.data;
	const normalizedMessages = normalizeMessagesForAgent(validatedMessages);
	const userJwt = c.get("jwtPayload").sub;
	const logger = c.get("logger");
	const selectedAgentMode = resolveAgentMode(agentMode);
	const modelMessages = await convertToModelMessages(normalizedMessages, {
		ignoreIncompleteToolCalls: true
	});
	const telemetryMetadata = {
		agentMode: selectedAgentMode,
		requestedModel: model
	};

	const result = await propagateAttributes(
		{
			metadata: telemetryMetadata,
			...(coalescedChatId ? { sessionId: coalescedChatId } : {}),
			tags: ["chat", "ai", selectedAgentMode],
			traceName: "ai-chat-stream",
			userId: userJwt.id,
			version: "agents-v1"
		},
		async () =>
			getChatAgent(selectedAgentMode).stream({
				abortSignal: c.req.raw.signal,
				experimental_transform: smoothStream(),
				messages: modelMessages,
				options: {
					conversationId: coalescedChatId,
					requestedModel: model,
					toolNames,
					userId: userJwt.id
				}
			})
	);

	return result.toUIMessageStreamResponse<MyUIMessage>({
		consumeSseStream: consumeStream,
		generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
		onError: (error: unknown) => {
			logger.error({ error, selectedAgentMode }, "AI agent stream failed");
			return "The assistant request failed. Please retry.";
		},
		onFinish: async ({ isAborted, messages: finalMessages }) => {
			if (isAborted) {
				return;
			}

			await saveConversation(coalescedChatId, finalMessages, userJwt.id);
		},
		originalMessages: validatedMessages,
		sendReasoning: true,
		sendSources: true
	});
};
