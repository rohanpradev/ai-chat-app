import { ChatRequestSchema, defaultModelId, safeValidateMyUIMessages } from "@chat-app/shared";
import { propagateAttributes } from "@langfuse/tracing";
import { consumeStream, createAgentUIStreamResponse, createIdGenerator, smoothStream } from "ai";
import { HTTPException } from "hono/http-exception";
import { normalizeMessagesForAgent } from "@/lib/agent-message-normalizer";
import { getChatAgent, resolveAgentMode } from "@/lib/agents";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import { isTelemetryEnabled } from "@/lib/instrumentation";
import type { AppRouteHandler } from "@/lib/types";
import type { AIStreamRoute, GetAvailableModelsRoute } from "@/routes/ai/ai.route";
import { loadConversationMessages, mergeConversationMessages, saveConversation } from "@/services/conversation.service";
import { getAvailableChatModels } from "@/services/model-catalog.service";

const agentStreamTimeout = {
	chunkMs: 20_000,
	stepMs: 45_000,
	toolMs: 30_000,
	tools: {
		serperMs: 20_000
	},
	totalMs: 120_000
} as const;

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
	const userJwt = c.get("jwtPayload").sub;
	const incomingMessages = requestBody.messages ?? (requestBody.message ? [requestBody.message] : []);
	if (requestBody.messages && coalescedChatId) {
		await loadConversationMessages(coalescedChatId, userJwt.id);
	}
	const storedMessages = requestBody.messages ? [] : await loadConversationMessages(coalescedChatId, userJwt.id);
	const candidateMessages = requestBody.messages
		? incomingMessages
		: mergeConversationMessages(storedMessages, incomingMessages);
	const validation = await safeValidateMyUIMessages(candidateMessages);

	if (!validation.success) {
		throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
			message: `Invalid UI messages payload: ${validation.error.message}`
		});
	}

	const validatedMessages = validation.data;
	const normalizedMessages = normalizeMessagesForAgent(validatedMessages);
	const logger = c.get("logger");
	const selectedAgentMode = resolveAgentMode(agentMode);
	const responseCreatedAt = new Date().toISOString();
	const telemetryMetadata = {
		agentMode: selectedAgentMode,
		requestedModel: model
	};
	const messageMetadata = {
		...(coalescedChatId ? { conversationId: coalescedChatId } : {}),
		createdAt: responseCreatedAt,
		model
	};
	const runAgentStream = () =>
		createAgentUIStreamResponse({
			abortSignal: c.req.raw.signal,
			agent: getChatAgent(selectedAgentMode),
			consumeSseStream: consumeStream,
			experimental_transform: smoothStream(),
			generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
			messageMetadata: ({ part }) => {
				if (part.type === "start") {
					return messageMetadata;
				}

				if (part.type === "finish") {
					return {
						...messageMetadata,
						finishReason: part.finishReason,
						totalTokens: part.totalUsage.totalTokens
					};
				}

				return undefined;
			},
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
			onStepFinish: ({ finishReason, stepNumber, toolCalls, toolResults, usage, warnings }) => {
				logger.debug(
					{
						finishReason,
						stepNumber,
						toolCallCount: toolCalls.length,
						toolResultCount: toolResults.length,
						totalTokens: usage.totalTokens,
						warningCount: warnings?.length ?? 0
					},
					"AI agent step finished"
				);
			},
			options: {
				conversationId: coalescedChatId,
				requestedModel: model,
				toolNames,
				userId: userJwt.id
			},
			sendReasoning: true,
			sendSources: true,
			timeout: agentStreamTimeout,
			uiMessages: normalizedMessages
		});

	return isTelemetryEnabled
		? await propagateAttributes(
				{
					metadata: telemetryMetadata,
					...(coalescedChatId ? { sessionId: coalescedChatId } : {}),
					tags: ["chat", "ai", selectedAgentMode],
					traceName: "ai-chat-stream",
					userId: userJwt.id,
					version: "agents-v1"
				},
				runAgentStream
			)
		: await runAgentStream();
};
