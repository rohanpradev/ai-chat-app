import { coerceCompatibleMyUIMessages } from "@chat-app/shared";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useRef } from "react";
import { z } from "zod";
import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ApiRequestError } from "@/composables/useApi";
import { useAgentChat } from "@/hooks/useAgentChat";
import { getAiModelsQuery } from "@/queries/getAiModels";
import { getConversationQuery } from "@/queries/getConversation";
import { Route as ChatIndexRoute } from "@/routes/chat/index";

const conversationSearchSchema = z.object({
  autoSend: z.literal("1").optional().catch(undefined),
  prompt: z.string().max(4_000).optional().catch(undefined),
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/chat/$conversationId")({
  validateSearch: zodValidator(conversationSearchSchema),
  loader: async ({ context, params }) => {
    const chatQuery = getConversationQuery(params.conversationId);

    try {
      const conversation = await context.queryClient.ensureQueryData(chatQuery);
      void context.queryClient.prefetchQuery(getAiModelsQuery());

      if (!conversation) {
        throw redirect({
          search: { redirect: undefined },
          to: ChatIndexRoute.to,
        });
      }

      type MessageRole = "user" | "assistant" | "system";
      const normalizeRole = (role: string): MessageRole => {
        if (role === "assistant" || role === "system") return role;
        return "user";
      };

      const toMetadata = (metadata: unknown, createdAt: string | undefined) => {
        const normalizedMetadata = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
        return createdAt ? { ...normalizedMetadata, createdAt } : normalizedMetadata;
      };

      const rawMessages = (conversation.messages || []).map((msg) => {
        const uiParts = msg.parts.map((part) => {
          if (typeof part === "string") {
            return { type: "text" as const, text: part };
          }
          return part;
        });

        return {
          id: msg.id,
          metadata: toMetadata(msg.metadata, msg.createdAt),
          parts: uiParts,
          role: normalizeRole(msg.role),
        };
      });

      return {
        chat: conversation,
        initialMessages: await coerceCompatibleMyUIMessages(rawMessages),
      };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) {
        throw error;
      }

      if (error instanceof ApiRequestError && error.status === 404) {
        throw redirect({
          search: { redirect: undefined },
          to: ChatIndexRoute.to,
        });
      }

      throw error;
    }
  },
  component: ConversationChat,
  errorComponent: () => (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Failed to load conversation</h2>
        <p className="text-gray-600 mb-4">Something went wrong while opening this chat. Please try again.</p>
        <button
          type="button"
          onClick={() => globalThis.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </div>
  ),
  pendingComponent: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  ),
});

function ConversationChat() {
  const { conversationId } = Route.useParams();
  const { autoSend, prompt } = Route.useSearch();
  const { initialMessages } = Route.useLoaderData();
  const navigate = useNavigate();
  const autoSendStartedRef = useRef(false);
  const {
    addToolApprovalResponse,
    agentMode,
    availableModels,
    clearError,
    error,
    input,
    messages,
    model,
    regenerate,
    sendPromptMessage,
    setAgentMode,
    setInput,
    setModel,
    setWebSearch,
    showAgentGuide,
    status,
    stop,
    webSearch,
  } = useAgentChat({
    conversationId,
    initialInput: initialMessages.length === 0 ? prompt : undefined,
    initialMessages,
  });

  useEffect(() => {
    if (autoSend !== "1" || !prompt || initialMessages.length > 0 || autoSendStartedRef.current) {
      return;
    }

    autoSendStartedRef.current = true;
    setInput("");
    void sendPromptMessage({ files: [], text: prompt })
      .catch(() => setInput(prompt))
      .finally(() => {
        void navigate({
          params: { conversationId },
          replace: true,
          search: { autoSend: undefined, prompt: undefined, redirect: undefined },
          to: Route.to,
        });
      });
  }, [autoSend, conversationId, initialMessages.length, navigate, prompt, sendPromptMessage, setInput]);
  const hasMessages = messages.length > 0;
  const canDownloadConversation = hasMessages && status !== "submitted" && status !== "streaming";

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent className={hasMessages ? "pb-6 pr-16" : "pb-6"}>
          <ChatMessages
            messages={messages}
            status={status}
            error={error}
            onRetry={(messageId) => regenerate(messageId ? { messageId } : undefined)}
            onClearError={clearError}
            onToolApprovalResponse={addToolApprovalResponse}
          />
        </ConversationContent>
        {canDownloadConversation ? (
          <ConversationDownload aria-label="Download conversation" messages={messages} />
        ) : null}
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-3 sm:p-6">
        <ChatInput
          availableModels={availableModels}
          input={input}
          setInput={setInput}
          agentMode={agentMode}
          setAgentMode={setAgentMode}
          model={model}
          setModel={setModel}
          webSearch={webSearch}
          setWebSearch={setWebSearch}
          onMessageSend={sendPromptMessage}
          onStop={stop}
          showAgentGuide={showAgentGuide}
          status={status}
        />
      </div>
    </>
  );
}
