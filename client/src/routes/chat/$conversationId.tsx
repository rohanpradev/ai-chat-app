import { useChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@chat-app/shared";
import type { GetConversationResponse } from "@chat-app/shared/types/conversation.types";
import { queryOptions } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
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
    queryKey: [...CHAT_QUERY_KEY.chats, conversationId],
    queryFn: () => callApi<GetConversationResponse>(`conversations/${conversationId}`),
    staleTime: 10 * 1000, // Consider data fresh for 10 seconds
    refetchOnWindowFocus: true, // Refetch when window gains focus to check for updates
    retry: (failureCount, error) => {
      // Don't retry on 404s (chat not found)
      if ((error as Error & { status?: number })?.status === 404) return false;
      return failureCount < 3;
    },
  });
};

export const Route = createFileRoute("/chat/$conversationId")({
  loader: async ({ context, params }) => {
    // Fetch the conversation with messages
    const chatQuery = getConversationQuery(params.conversationId);
    try {
      const conversation = await context.queryClient.ensureQueryData(chatQuery);

      if (!conversation) {
        // Redirect to chat index if conversation not found or not accessible
        throw redirect({
          to: ChatIndexRoute.to,
          search: { redirect: undefined },
        });
      }

      type MessageRole = "user" | "assistant" | "system";

      interface StoredMessage {
        id: string;
        role: MessageRole;
        parts: any[]; // Using any here since the stored parts can be of any structure
        metadata?: Record<string, unknown>;
      }

      // Convert stored messages to UI messages
      const messages =
        conversation.messages?.map((msg: StoredMessage) => {
          // Convert parts to match the UI message format
          const uiParts = msg.parts.map((part) => {
            if (typeof part === "string") {
              return { type: "text" as const, text: part };
            }
            // Preserve the original structure for tool and file parts
            return part;
          });

          return {
            id: msg.id,
            role: msg.role,
            parts: uiParts,
            metadata: msg.metadata || {},
          };
        }) || [];

      return {
        chat: conversation,
        initialMessages: messages,
      };
    } catch (error) {
      console.error("Failed to load chat:", error);
      throw redirect({
        to: ChatIndexRoute.to,
        search: { redirect: undefined },
      });
    }
  },
  component: ConversationChat,
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
