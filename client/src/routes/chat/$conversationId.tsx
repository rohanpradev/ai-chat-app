import { type MyUIMessage, validateMyUIMessages } from "@chat-app/shared";
import { queryOptions } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { getApiClient } from "@/composables/useApi";
import { useAgentChat } from "@/hooks/useAgentChat";
import { Route as ChatIndexRoute } from "@/routes/chat/index";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

const getConversationQuery = (conversationId: string) => {
  const api = getApiClient();
  return queryOptions({
    queryFn: () => api.conversations.get(conversationId),
    queryKey: CHAT_QUERY_KEY.conversation(conversationId),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: (failureCount, error) => {
      const status = (error as Error & { status?: number })?.status;
      if (status === 404 || status === 403) return false;
      return failureCount < 2;
    },
  });
};

export const Route = createFileRoute("/chat/$conversationId")({
  loader: async ({ context, params }) => {
    const chatQuery = getConversationQuery(params.conversationId);

    try {
      const conversation = await context.queryClient.ensureQueryData(chatQuery);

      if (!conversation) {
        throw redirect({
          search: { redirect: undefined },
          to: ChatIndexRoute.to,
        });
      }

      type MessageRole = "user" | "assistant" | "system";
      interface StoredMessage {
        id: string;
        role: string;
        parts: unknown[];
        metadata?: Record<string, unknown>;
      }

      const normalizeRole = (role: string): MessageRole => {
        if (role === "assistant" || role === "system") return role;
        return "user";
      };

      const rawMessages = (conversation.messages || []).map((msg: StoredMessage) => {
        const uiParts = msg.parts.map((part) => {
          if (typeof part === "string") {
            return { type: "text" as const, text: part };
          }
          return part;
        });

        return {
          id: msg.id,
          metadata: msg.metadata || {},
          parts: uiParts,
          role: normalizeRole(msg.role),
        };
      });

      const messages = rawMessages.length > 0 ? await validateMyUIMessages(rawMessages) : [];

      return {
        chat: conversation,
        initialMessages: messages,
      };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) {
        throw error;
      }
      console.error("Failed to load chat:", error);
      return {
        chat: { id: params.conversationId, messages: [], title: "New Chat" },
        initialMessages: [],
      };
    }
  },
  component: ConversationChat,
  errorComponent: ({ error }) => (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Failed to load conversation</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
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
  const { initialMessages } = Route.useLoaderData();
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
    webSearch,
  } = useAgentChat({
    conversationId,
    initialMessages: initialMessages as MyUIMessage[],
  });

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent className="pb-6">
          <ChatMessages
            messages={messages}
            status={status}
            error={error}
            onRetry={() => regenerate()}
            onClearError={clearError}
            onToolApprovalResponse={addToolApprovalResponse}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-6">
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
          showAgentGuide={showAgentGuide}
          status={status}
        />
      </div>
    </>
  );
}
