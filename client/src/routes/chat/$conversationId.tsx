import { useChat } from "@ai-sdk/react";
import type { GetConversationResponse, MyUIMessage } from "@chat-app/shared";
import { tools } from "@chat-app/shared";
import { queryOptions } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { DefaultChatTransport, validateUIMessages } from "ai";
import type { ClipboardEvent } from "react";
import { useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { useApi } from "@/composables/useApi";
import { Route as ChatIndexRoute } from "@/routes/chat/index";
import { models } from "@/utils";
import { convertFilesToDataURLs } from "@/utils/fileUtils";
import { CHAT_QUERY_KEY } from "@/utils/query-key";

const getConversationQuery = (conversationId: string) => {
  const { callApi } = useApi();
  return queryOptions({
    queryKey: CHAT_QUERY_KEY.conversation(conversationId),
    queryFn: () => callApi<GetConversationResponse>(`conversations/${conversationId}`),
    staleTime: 30 * 1000, // Consider data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
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

      // Allow empty conversations (new chats)
      if (!conversation) {
        throw redirect({
          to: ChatIndexRoute.to,
          search: { redirect: undefined },
        });
      }

      type MessageRole = "user" | "assistant" | "system";
      interface StoredMessage {
        id: string;
        role: MessageRole;
        parts: unknown[];
        metadata?: Record<string, unknown>;
      }

      const rawMessages = (conversation.messages || []).map((msg: StoredMessage) => {
        const uiParts = msg.parts.map((part) => {
          if (typeof part === "string") {
            return { type: "text" as const, text: part };
          }
          return part;
        });

        return {
          id: msg.id,
          role: msg.role,
          parts: uiParts,
          metadata: msg.metadata || {},
        };
      });

      const messages = rawMessages.length > 0 ? await validateUIMessages({
        messages: rawMessages as MyUIMessage[],
        tools: tools as Record<string, unknown>,
      }) : [];

      return {
        chat: conversation,
        initialMessages: messages,
      };
    } catch (error) {
      if (error && typeof error === "object" && "to" in error) {
        throw error; // Re-throw redirect errors
      }
      console.error("Failed to load chat:", error);
      // Don't redirect on API errors, allow empty chat
      return {
        chat: { id: params.conversationId, title: "New Chat", messages: [] },
        initialMessages: [],
      };
    }
  },
  component: ConversationChat,
  pendingComponent: () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Failed to load conversation</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    </div>
  ),
});

function ConversationChat() {
  const { conversationId } = Route.useParams();
  const { initialMessages } = Route.useLoaderData();
  const [input, setInput] = useState("");
  const [model, setModel] = useState(models[0].id); // This will now be "gpt-4.1-mini"
  const [webSearch, setWebSearch] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [files, setFiles] = useState<FileList | undefined>(undefined);

  const { messages, sendMessage, status, error, clearError, regenerate } = useChat<MyUIMessage>({
    id: conversationId,
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/ai/text-stream",
      credentials: "include",
    }),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      const fileParts = files && files.length > 0 ? await convertFilesToDataURLs(files) : [];

      sendMessage(
        {
          role: "user",
          parts: [{ type: "text", text: input }, ...fileParts],
        },
        {
          body: {
            model: model,
            webSearch: webSearch,
            tools: selectedTools,
            chatId: conversationId,
          },
        },
      );
      setFiles(undefined);
      setInput("");
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardFiles = e.clipboardData?.files;
    if (clipboardFiles && clipboardFiles.length > 0) {
      const newFiles = new DataTransfer();
      if (files) {
        Array.from(files).forEach((f) => {
          newFiles.items.add(f);
        });
      }
      Array.from(clipboardFiles).forEach((f) => {
        newFiles.items.add(f);
      });
      setFiles(newFiles.files);
    }
  };

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
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-6">
        <ChatInput
          input={input}
          setInput={setInput}
          model={model}
          setModel={setModel}
          webSearch={webSearch}
          setWebSearch={setWebSearch}
          selectedTools={selectedTools}
          setSelectedTools={setSelectedTools}
          files={files}
          setFiles={setFiles}
          onSubmit={handleSubmit}
          onPaste={handlePaste}
          status={status}
        />
      </div>
    </>
  );
}
