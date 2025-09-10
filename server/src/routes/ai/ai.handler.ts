import { createIdGenerator, smoothStream, streamText, validateUIMessages } from "ai";
import { getAvailableTools } from "@/lib/tools";
import type { AppRouteHandler } from "@/lib/types";
import type { AIStreamRoute } from "@/routes/ai/ai.route";
import { saveConversation } from "@/services/conversation.service";
import { MODELS, transformPrompt } from "@/utils/index";
import { createTelemetryConfig, extractTraceContext } from "@/utils/langfuse-helpers";

export const aiStream: AppRouteHandler<AIStreamRoute> = async (c) => {
	const requestBody = c.req.valid("json");
	const coalescedChatId = requestBody.chatId || requestBody.id || requestBody.conversationId;
	const { messages: uiMessages, model = "gpt-5-mini", tools: toolNames = [] } = requestBody;

	const selectedTools = getAvailableTools(toolNames);
	const validatedMessages = await validateUIMessages({
		messages: uiMessages,
		tools: selectedTools
	});

	const messages = transformPrompt(validatedMessages);

	const userJwt = c.get("jwtPayload").sub;

	// Extract trace context for Langfuse
	const traceContext = extractTraceContext(c);
	const telemetryConfig = createTelemetryConfig({
		...traceContext,
		functionId: "ai-stream-chat",
		metadata: {
			conversationId: coalescedChatId,
			messageCount: messages.length,
			model,
			toolCount: toolNames.length
		},
		sessionId: coalescedChatId || undefined,
		tags: ["chat", "stream", model],
		userId: userJwt.id
	});

	const result = streamText({
		experimental_telemetry: telemetryConfig,
		experimental_transform: smoothStream(),
		messages,
		model: MODELS.azureOpenAI(model),
		tools: selectedTools
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
