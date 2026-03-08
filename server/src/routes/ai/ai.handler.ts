import { ChatRequestSchema, safeValidateMyUIMessages } from "@chat-app/shared";
import { consumeStream, createIdGenerator, smoothStream, streamText } from "ai";
import { HTTPException } from "hono/http-exception";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { getAvailableTools } from "@/lib/tools";
import type { AppRouteHandler } from "@/lib/types";
import type { AIStreamRoute } from "@/routes/ai/ai.route";
import { saveConversation } from "@/services/conversation.service";
import {
  resolveModel,
  resolveModelSelection,
  transformPrompt,
} from "@/utils/index";

export const aiStream: AppRouteHandler<AIStreamRoute> = async (c) => {
  const requestBody = ChatRequestSchema.parse(await c.req.json());
  const coalescedChatId =
    requestBody.chatId || requestBody.id || requestBody.conversationId;
  const { model = "gpt-5-mini", tools: toolNames = [] } = requestBody;
  const uiMessages = requestBody.messages;

  const selectedTools = getAvailableTools(toolNames);
  const validation = await safeValidateMyUIMessages(uiMessages);

  if (!validation.success) {
    throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
      message: `Invalid UI messages payload: ${validation.error.message}`,
    });
  }
  const validatedMessages = validation.data;
  const resolvedModel = resolveModelSelection(model);

  const messages = await transformPrompt(validatedMessages);
  const userJwt = c.get("jwtPayload").sub;

  const result = streamText({
    abortSignal: c.req.raw.signal,
    experimental_telemetry: {
      functionId: "ai-stream-chat",
      isEnabled: true,
      metadata: {
        userId: userJwt.id,
        ...(coalescedChatId && { sessionId: coalescedChatId }),
        model: resolvedModel.id,
        requestedModel: model,
        tags: ["chat", "stream", resolvedModel.id, resolvedModel.provider],
        toolCount: toolNames.length,
        ...(toolNames.length > 0 && { tools: toolNames.join(",") }),
      },
    },
    experimental_transform: smoothStream(),
    messages,
    model: resolveModel(model),
    tools: selectedTools,
  });

  return result.toUIMessageStreamResponse({
    consumeSseStream: consumeStream,
    generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
    onFinish: async ({ isAborted, messages: finalMessages }) => {
      if (isAborted) {
        return;
      }
      await saveConversation(coalescedChatId, finalMessages, userJwt.id);
    },
    originalMessages: validatedMessages,
    sendReasoning: true,
    sendSources: true,
  });
};
