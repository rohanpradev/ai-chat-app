import { useChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@chat-app/shared";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import type { ClipboardEvent } from "react";
import { useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { chatsQuery } from "@/lib/queries";
import { Route as ChatIndexRoute } from "@/routes/chat/index";
import { models } from "@/utils";
import { convertFilesToDataURLs } from "@/utils/fileUtils";

export const Route = createFileRoute("/chat/$conversationId")({
  loader: async ({ context, params }) => {
    // Conversations are already loaded by parent /chat route, so we can access from cache
    const chats = context.queryClient.getQueryData(chatsQuery().queryKey);
    const chat = chats?.find((c) => c.id === params.conversationId);

    if (!chat) {
      // Instead of throwing notFound, redirect to chat index where empty state is handled
      throw redirect({ to: ChatIndexRoute.to, search: { redirect: undefined } });
    }

    return {
      initialMessages: (chat?.messages || []) as MyUIMessage[],
    };
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
