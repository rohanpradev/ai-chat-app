import { defaultModelId, safeValidateMyUIMessages } from "@chat-app/shared";
import { propagateAttributes } from "@langfuse/tracing";
import { consumeStream, createAgentUIStreamResponse, createIdGenerator, smoothStream } from "ai";
import { HTTPException } from "hono/http-exception";
import { normalizeMessagesForAgent } from "@/lib/agent-message-normalizer";
import { getChatAgent, resolveAgentMode } from "@/lib/agents";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import { isTelemetryEnabled } from "@/lib/instrumentation";
import type { AppRouteHandler } from "@/lib/types";
import type {
	AIStreamRoute,
	EvaluateOutputRoute,
	GeneratePlanRoute,
	GetAvailableModelsRoute,
	GetUsageRoute
} from "@/routes/ai/ai.route";
import { evaluateAIOutput, generateStructuredPlan } from "@/services/ai-structured.service";
import { loadConversationMessages, mergeConversationMessages, saveConversation } from "@/services/conversation.service";
import { getAvailableChatModels } from "@/services/model-catalog.service";
import { estimateTokens, getUsageSummary, reserveUsage, settleUsage } from "@/services/usage.service";
import { resolveModelSelection } from "@/utils/index";

const streamingProxyHeaders = {
	"Cache-Control": "no-cache, no-transform",
	"X-Accel-Buffering": "no"
} as const;

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

export const getUsage: AppRouteHandler<GetUsageRoute> = async (c) =>
	c.json({
		data: await getUsageSummary(c.get("jwtPayload").sub.id),
		message: "AI usage retrieved successfully"
	});

export const generatePlan: AppRouteHandler<GeneratePlanRoute> = async (c) => {
	const requestBody = c.req.valid("json");
	const userJwt = c.get("jwtPayload").sub;
	const result = await generateStructuredPlan(requestBody, userJwt.id, c.req.raw.signal);

	return c.json({
		data: result.data,
		message: "Structured AI plan generated successfully",
		metadata: result.metadata
	});
};

export const evaluateOutput: AppRouteHandler<EvaluateOutputRoute> = async (c) => {
	const requestBody = c.req.valid("json");
	const userJwt = c.get("jwtPayload").sub;
	const result = await evaluateAIOutput(requestBody, userJwt.id, c.req.raw.signal);

	return c.json({
		data: result.data,
		message: "AI output evaluated successfully",
		metadata: result.metadata
	});
};

export const aiStream: AppRouteHandler<AIStreamRoute> = async (c) => {
	const requestBody = c.req.valid("json");
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
	if (validatedMessages.some((message) => message.role === "system")) {
		throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
			message: "Client-authored system messages are not allowed"
		});
	}
	const normalizedMessages = normalizeMessagesForAgent(validatedMessages);
	const logger = c.get("logger");
	const selectedAgentMode = resolveAgentMode(agentMode);
	const resolvedModel = await resolveModelSelection(model);
	const responseCreatedAt = new Date().toISOString();
	const usageRequestId = await reserveUsage({
		category: "chat-stream",
		estimatedTokens: estimateTokens(validatedMessages) + 4096,
		model: resolvedModel.id,
		scope: "ai",
		userId: userJwt.id
	});
	let inputTokens = 0;
	let outputTokens = 0;
	let totalTokens = 0;
	const telemetryMetadata = {
		agentMode: selectedAgentMode,
		model: resolvedModel.id,
		modelProvider: resolvedModel.provider,
		requestedModel: model
	};
	const messageMetadata = {
		...(coalescedChatId ? { conversationId: coalescedChatId } : {}),
		createdAt: responseCreatedAt,
		model: resolvedModel.id,
		...(model !== resolvedModel.id ? { requestedModel: model } : {})
	};
	const runAgentStream = () =>
		createAgentUIStreamResponse({
			abortSignal: c.req.raw.signal,
			agent: getChatAgent(selectedAgentMode),
			consumeSseStream: consumeStream,
			experimental_transform: smoothStream(),
			generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
			headers: streamingProxyHeaders,
			messageMetadata: ({ part }) => {
				if (part.type === "start") {
					return messageMetadata;
				}

				if (part.type === "finish") {
					inputTokens = part.totalUsage.inputTokens ?? inputTokens;
					outputTokens = part.totalUsage.outputTokens ?? outputTokens;
					totalTokens = part.totalUsage.totalTokens ?? totalTokens;
					return {
						...messageMetadata,
						finishReason: part.finishReason,
						totalTokens: part.totalUsage.totalTokens
					};
				}

				return undefined;
			},
			onEnd: async ({ isAborted, messages: finalMessages }) => {
				await Promise.all([
					saveConversation(coalescedChatId, finalMessages, userJwt.id),
					settleUsage(usageRequestId, { inputTokens, outputTokens, totalTokens })
				]);
				if (isAborted) {
					logger.debug({ selectedAgentMode }, "Persisted cancelled AI agent stream");
				}
			},
			onError: (error: unknown) => {
				logger.error({ error, selectedAgentMode }, "AI agent stream failed");
				return "The assistant request failed. Please retry.";
			},
			onStepEnd: ({ finishReason, stepNumber, toolCalls, toolResults, usage, warnings }) => {
				inputTokens += usage.inputTokens ?? 0;
				outputTokens += usage.outputTokens ?? 0;
				totalTokens += usage.totalTokens ?? 0;
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
				requestedModel: resolvedModel.id,
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
