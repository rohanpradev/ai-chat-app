import { useChat } from "@ai-sdk/react";
import {
  type AgentMode,
  type AIModelDefinition,
  type AIModelId,
  type ConversationDetail,
  defaultAgentMode,
  defaultModelId,
  models as fallbackModels,
  type MyUIMessage,
  myUIMessageMetadataSchema,
} from "@chat-app/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ChatAddToolApproveResponseFunction,
  DefaultChatTransport,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { apiBasePath, apiClient } from "@/composables/useApi";
import { buildChatRequestBody } from "@/lib/chat-request";
import { captureSentryException } from "@/lib/sentry";
import { getAiModelsQuery } from "@/queries/getAiModels";
import { AI_QUERY_KEY, CHAT_QUERY_KEY } from "@/utils/query-key";

interface UseAgentChatOptions {
  conversationId?: string;
  initialInput?: string;
  initialMcp?: boolean;
  initialMessages?: MyUIMessage[];
}

const aiStreamApiPath = `${apiBasePath}${apiClient.ai["text-stream"].$path()}`;

export function useAgentChat({
  conversationId,
  initialInput = "",
  initialMcp = false,
  initialMessages = [],
}: Readonly<UseAgentChatOptions>) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState(initialInput);
  const [agentMode, setAgentMode] = useState<AgentMode>(defaultAgentMode);
  const [model, setModel] = useState<AIModelId>(defaultModelId);
  const [mcp, setMcp] = useState(initialMcp);
  const [webSearch, setWebSearch] = useState(false);
  const availableModelsQuery = useQuery(getAiModelsQuery());

  const transport = useMemo(() => {
    const requestBody = buildChatRequestBody({ conversationId, agentMode, model, webSearch, mcp });

    return new DefaultChatTransport<MyUIMessage>({
      api: aiStreamApiPath,
      credentials: "include",
      prepareSendMessagesRequest: ({ body, id, messageId, messages, trigger }) => ({
        body: {
          ...body,
          id,
          ...(trigger === "submit-message" ? { message: messages.at(-1) } : { messages }),
          messageId,
          trigger,
          ...requestBody,
        },
      }),
    });
  }, [conversationId, agentMode, model, webSearch, mcp]);

  const chat = useChat<MyUIMessage>({
    ...(conversationId ? { id: conversationId } : {}),
    messageMetadataSchema: myUIMessageMetadataSchema,
    messages: initialMessages,
    onFinish: ({ messages }) => {
      if (conversationId) {
        queryClient.setQueryData<ConversationDetail>(CHAT_QUERY_KEY.conversation(conversationId), (current) =>
          current ? { ...current, messages } : current,
        );
        void queryClient.invalidateQueries({ queryKey: CHAT_QUERY_KEY.chats, exact: true });
      }
      void queryClient.invalidateQueries({ queryKey: AI_QUERY_KEY.usage, exact: true });
    },
    onError: (error) => {
      captureSentryException(error);
      console.error("AI chat request failed:", error);
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    throttle: 50,
    transport,
  });
  const pendingApprovalIdsRef = useRef(new Set<string>());

  useEffect(() => {
    const pendingApprovalIds = pendingApprovalIdsRef.current;
    if (pendingApprovalIds.size === 0) return;

    const requestedApprovalIds = new Set(
      chat.messages.flatMap((message) =>
        message.parts.flatMap((part) =>
          isToolUIPart(part) && part.state === "approval-requested" ? [part.approval.id] : [],
        ),
      ),
    );

    for (const approvalId of pendingApprovalIds) {
      if (!requestedApprovalIds.has(approvalId)) {
        pendingApprovalIds.delete(approvalId);
      }
    }
  }, [chat.messages]);

  const addToolApprovalResponseOnce = useCallback<ChatAddToolApproveResponseFunction>(
    async (response) => {
      if (pendingApprovalIdsRef.current.has(response.id)) {
        return;
      }

      pendingApprovalIdsRef.current.add(response.id);

      try {
        await chat.addToolApprovalResponse(response);
      } catch (error) {
        pendingApprovalIdsRef.current.delete(response.id);
        throw error;
      }
    },
    [chat.addToolApprovalResponse],
  );

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

  const sendPromptMessage = useCallback(
    ({ files, text }: PromptInputMessage) => chat.sendMessage({ files, text: text || "Sent with attachments" }),
    [chat.sendMessage],
  );

  return {
    ...chat,
    addToolApprovalResponse: addToolApprovalResponseOnce,
    agentMode,
    availableModels,
    input,
    model,
    sendPromptMessage,
    setAgentMode,
    setInput,
    setModel,
    setWebSearch,
    setMcp,
    showAgentGuide: chat.messages.length === 0,
    webSearch,
    mcp,
  };
}
