import {
  consumeStream,
  createIdGenerator,
  safeValidateUIMessages,
  smoothStream,
  streamText,
  type UIMessage,
} from "ai";
import { HTTPException } from "hono/http-exception";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { getAvailableTools } from "@/lib/tools";
import type { AppRouteHandler } from "@/lib/types";
import type { AIStreamRoute } from "@/routes/ai/ai.route";
import { saveConversation } from "@/services/conversation.service";
import { resolveModel, transformPrompt } from "@/utils/index";

export const aiStream: AppRouteHandler<AIStreamRoute> = async (c) => {
  const requestBody = c.req.valid("json");
  const coalescedChatId =
    requestBody.chatId || requestBody.id || requestBody.conversationId;
  const { model = "gpt-5-mini", tools: toolNames = [] } = requestBody;
  const uiMessages = requestBody.messages as UIMessage[];

  const selectedTools = getAvailableTools(toolNames);
  type ValidationToolSet = NonNullable<
    Parameters<typeof safeValidateUIMessages<UIMessage>>[0]["tools"]
  >;
  const validationTools = selectedTools as ValidationToolSet | undefined;

  const validation = await safeValidateUIMessages({
    messages: uiMessages,
    ...(validationTools ? { tools: validationTools } : {}),
  });

  if (!validation.success) {
    throw new HTTPException(HttpStatusCodes.BAD_REQUEST, {
      message: `Invalid UI messages payload: ${validation.error.message}`,
    });
  }
  const validatedMessages = validation.data;

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
        model,
        tags: ["chat", "stream", model],
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
    originalMessages: uiMessages,
    sendReasoning: true,
    sendSources: true,
  });
};
