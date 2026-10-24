import { coerceCompatibleMyUIMessages } from "@chat-app/shared";
import { skipToken, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { zodValidator } from "@tanstack/zod-adapter";
import { useEffect, useRef, useState } from "react";
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
import { type ConversationDraft, conversationDraftKey } from "@/lib/conversation-draft";
import { mcpDraftKey } from "@/lib/mcp-draft";
import { getAiModelsQuery } from "@/queries/getAiModels";
import { getConversationQuery } from "@/queries/getConversation";
import { Route as ChatIndexRoute } from "@/routes/chat/index";

const conversationSearchSchema = z.object({
  mcp: z.literal("1").optional().catch(undefined),
  autoSend: z.literal("1").optional().catch(undefined),
  prompt: z.string().max(4_000).optional().catch(undefined),
  redirect: z.string().optional().catch(undefined),
});

export const Route = createFileRoute("/chat/$conversationId")({
  remountDeps: ({ params }) => params.conversationId,
  validateSearch: zodValidator(conversationSearchSchema),
  loader: {
    // Chat state is initialized once; never mount it from an old router snapshot.
    staleReloadMode: "blocking",
    handler: async ({ context, params }) => {
      const chatQuery = getConversationQuery(params.conversationId);

      try {
        const conversation = await context.queryClient.query(chatQuery);
        void context.queryClient.query(getAiModelsQuery()).catch(() => undefined);

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
          const normalizedMetadata =
            metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
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
  const { autoSend, prompt, mcp: initialMcp } = Route.useSearch();
  const { initialMessages } = Route.useLoaderData();
  const { auth } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const draftUserId = auth.user?.id ?? "";
  const [initialDraft] = useState(() =>
    queryClient.getQueryData<ConversationDraft>(conversationDraftKey(draftUserId, conversationId)),
  );
  useEffect(
    () => () => {
      queryClient.removeQueries({ queryKey: mcpDraftKey(draftUserId, conversationId), exact: true });
      queryClient.removeQueries({ queryKey: conversationDraftKey(draftUserId, conversationId), exact: true });
    },
    [queryClient, draftUserId, conversationId],
  );
  const { data: mcpDraft } = useQuery<string>({
    queryKey: mcpDraftKey(auth.user?.id ?? "", conversationId),
    queryFn: skipToken,
    gcTime: 0,
  });
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
    mcp,
    setMcp,
    showAgentGuide,
    status,
    stop,
    webSearch,
  } = useAgentChat({
    conversationId,
    initialMcp: initialMcp === "1",
    initialInput: initialMessages.length === 0 ? (mcpDraft ?? initialDraft?.text ?? prompt) : undefined,
    initialMessages,
  });

  const firstPrompt = initialDraft?.text ?? prompt;
  const shouldAutoSend = initialDraft?.autoSend || autoSend === "1";
  useEffect(() => {
    if (!shouldAutoSend || !firstPrompt || initialMessages.length > 0 || autoSendStartedRef.current) {
      return;
    }

    autoSendStartedRef.current = true;
    setInput("");
    void sendPromptMessage({ files: [], text: firstPrompt })
      .catch(() => setInput(firstPrompt))
      .finally(() => {
        queryClient.removeQueries({ queryKey: conversationDraftKey(draftUserId, conversationId), exact: true });
        if (autoSend || prompt) {
          void navigate({
            params: { conversationId },
            replace: true,
            search: { autoSend: undefined, prompt: undefined, redirect: undefined },
            to: Route.to,
          });
        }
      });
  }, [
    autoSend,
    conversationId,
    draftUserId,
    firstPrompt,
    initialMessages.length,
    navigate,
    prompt,
    queryClient,
    sendPromptMessage,
    setInput,
    shouldAutoSend,
  ]);
  const hasMessages = messages.length > 0;
  const canDownloadConversation = hasMessages && status !== "submitted" && status !== "streaming";

  return (
    <>
      <Conversation className="flex-1 bg-gradient-to-b from-background via-background to-muted/20">
        <ConversationContent
          className={hasMessages ? "mx-auto w-full max-w-4xl pb-8 pt-6 pr-16" : "mx-auto w-full max-w-4xl pb-8 pt-6"}
        >
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
          <ConversationDownload
            aria-label="Download conversation"
            className="z-10 bg-background/85 shadow-sm backdrop-blur"
            messages={messages}
          />
        ) : null}
        <ConversationScrollButton className="bottom-6 bg-background/85 shadow-md backdrop-blur" />
      </Conversation>

      <div className="shrink-0 border-t bg-background/90 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:px-6 sm:pb-5">
        <div className="mx-auto w-full max-w-4xl">
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
            mcp={mcp}
            setMcp={setMcp}
            onMessageSend={sendPromptMessage}
            onStop={stop}
            showAgentGuide={showAgentGuide}
            status={status}
          />
        </div>
      </div>
    </>
  );
}
