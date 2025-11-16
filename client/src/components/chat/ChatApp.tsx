import { useChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@chat-app/shared";
import { models } from "@chat-app/shared";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import type { PromptInputMessage } from "@/components/ai-elements/prompt-input";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useUserLogout } from "@/composables/useLogout";
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
  const [currentConversationId] = useState<string | undefined>();

  const { messages, sendMessage, status, error, clearError, regenerate } = useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: "/api/ai/text-stream",
      credentials: "include",
    }),
  });

  const handleMessageSend = async (message: PromptInputMessage) => {
    const fileParts = message.files && message.files.length > 0 ? await convertFilesToDataURLs(message.files) : [];

    sendMessage(
      {
        role: "user",
        parts: [{ type: "text", text: message.text || "Sent with attachments" }, ...fileParts],
      },
      {
        body: {
          model: model,
          webSearch: webSearch,
          tools: selectedTools,
          conversationId: currentConversationId,
          title: message.text?.slice(0, 50) || "New conversation",
        },
      },
    );
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

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full">
        <ConversationSidebar />

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
              onMessageSend={handleMessageSend}
              status={status}
            />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}
