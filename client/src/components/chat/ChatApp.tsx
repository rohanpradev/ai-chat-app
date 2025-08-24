import { useChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@chat-app/shared";
import { DefaultChatTransport } from "ai";
import type { ClipboardEvent } from "react";
import { useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatSidebar } from "@/components/chat/ConversationSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useUserLogout } from "@/composables/useLogout";

import { models } from "@/utils";
import { convertFilesToDataURLs } from "@/utils/fileUtils";

interface User {
  id: string;
  name: string;
  email: string;
  profileImage?: string | null;
}

interface ChatAppProps {
  user: User;
}

const suggestions = [
  "What are the latest trends in AI?",
  "How does machine learning work?",
  "Explain quantum computing",
];

export function ChatApp({ user }: ChatAppProps) {
  const { mutate: logout } = useUserLogout();

  const [input, setInput] = useState("");
  const [model, setModel] = useState(models[0].id);
  const [webSearch, setWebSearch] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [files, setFiles] = useState<FileList | undefined>(undefined);
  const [currentConversationId, setCurrentConversationId] = useState<string | undefined>();

  const { messages, sendMessage, status, setMessages, error, clearError, regenerate } = useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/ai/text-stream",
      credentials: "include",
    }),
  });

  const _handleNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(undefined);
    setInput("");
    setFiles(undefined);
    clearError();
  };

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
            conversationId: currentConversationId,
            title: input.slice(0, 50),
          },
        },
      );
      setFiles(undefined);
      setInput("");
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: suggestion }],
      },
      {
        body: {
          model: model,
          webSearch: webSearch,
          tools: selectedTools,
          conversationId: currentConversationId,
          title: suggestion.slice(0, 50),
        },
      },
    );
  };

  const _handleClearChat = () => {
    setMessages([]);
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
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full">
        <ChatSidebar />

        <div className="flex-1 flex flex-col">
          <ChatHeader user={user} onLogout={() => logout()} />

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
            {messages.length === 0 && (
              <Suggestions>
                {suggestions.map((suggestion) => (
                  <Suggestion key={suggestion} onClick={handleSuggestionClick} suggestion={suggestion} />
                ))}
              </Suggestions>
            )}
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
        </div>
      </div>
    </SidebarProvider>
  );
}
