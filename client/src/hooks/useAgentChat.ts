import { useChat } from "@ai-sdk/react";
import {
  type AgentMode,
  type AIModelDefinition,
  type AIModelId,
  defaultAgentMode,
  defaultModelId,
  models as fallbackModels,
  type MyUIMessage,
} from "@chat-app/shared";
import { useQuery } from "@tanstack/react-query";
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithApprovalResponses } from "ai";
import { useEffect, useRef, useState } from "react";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { buildChatRequestBody } from "@/lib/chat-request";
import { getAiModelsQuery } from "@/queries/getAiModels";
import { convertFilesToDataURLs } from "@/utils/fileUtils";

interface UseAgentChatOptions {
  conversationId?: string;
  initialMessages?: MyUIMessage[];
}

export function useAgentChat({ conversationId, initialMessages = [] }: Readonly<UseAgentChatOptions>) {
  const [input, setInput] = useState("");
  const [agentMode, setAgentMode] = useState<AgentMode>(defaultAgentMode);
  const [model, setModel] = useState<AIModelId>(defaultModelId);
  const [webSearch, setWebSearch] = useState(false);
  const availableModelsQuery = useQuery(getAiModelsQuery());

  const requestBodyRef = useRef(buildChatRequestBody({ conversationId, agentMode, model, webSearch }));
  const transportRef = useRef(
    new DefaultChatTransport<MyUIMessage>({
      api: "/api/ai/text-stream",
      credentials: "include",
      prepareSendMessagesRequest: ({ body, id, messageId, messages, trigger }) => ({
        body: {
          ...body,
          id,
          ...(trigger === "submit-message" ? { message: messages.at(-1) } : { messages }),
          messageId,
          trigger,
          ...requestBodyRef.current,
        },
      }),
    }),
  );

  requestBodyRef.current = buildChatRequestBody({
    conversationId,
    agentMode,
    model,
    webSearch,
  });

  const chat = useChat<MyUIMessage>({
    ...(conversationId ? { id: conversationId } : {}),
    messages: initialMessages,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    transport: transportRef.current,
  });

  const availableModels: AIModelDefinition[] =
    availableModelsQuery.data && availableModelsQuery.data.length > 0 ? availableModelsQuery.data : fallbackModels;

  useEffect(() => {
    if (availableModels.some((candidate) => candidate.id === model)) {
      return;
    }

    const nextModel = availableModels[0]?.id ?? defaultModelId;
    if (nextModel !== model) {
      setModel(nextModel);
    }
  }, [availableModels, model]);

  const sendPromptMessage = async (message: PromptInputMessage) => {
    const fileParts = message.files && message.files.length > 0 ? await convertFilesToDataURLs(message.files) : [];

    chat.sendMessage({
      role: "user",
      parts: [{ type: "text", text: message.text || "Sent with attachments" }, ...fileParts],
    });
  };

  return {
    ...chat,
    agentMode,
    availableModels,
    input,
    model,
    sendPromptMessage,
    setAgentMode,
    setInput,
    setModel,
    setWebSearch,
    showAgentGuide: chat.messages.length === 0,
    webSearch,
  };
}
