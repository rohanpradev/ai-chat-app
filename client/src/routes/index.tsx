import { useChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@chat-app/shared";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import type { ClipboardEvent } from "react";
import { useState } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { useUserLogout } from "@/composables/useLogout";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";
import { models } from "@/utils";
import { convertFilesToDataURLs } from "@/utils/fileUtils";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: LoginRoute.to });
    }
  },
  component: App,
});

const suggestions = [
  "What are the latest trends in AI?",
  "How does machine learning work?",
  "Explain quantum computing",
];

function App() {
  const { auth } = Route.useRouteContext();
  const { mutate: logout } = useUserLogout();
  const [input, setInput] = useState("");
  const [model, setModel] = useState(models[0].id);
  const [webSearch, setWebSearch] = useState(false);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [files, setFiles] = useState<FileList | undefined>(undefined);

  const { messages, sendMessage, status, setMessages, error, clearError, regenerate } = useChat<MyUIMessage>({
    transport: new DefaultChatTransport({
      api: `${import.meta.env.VITE_API_URL}/ai/text-stream`,
      credentials: "include",
    }),
    async onToolCall({ toolCall }) {
      // Handle client-side tools if needed
      if (toolCall.toolName === "deepSearch" || toolCall.toolName === "serper") {
        // These will be handled server-side, no client action needed
      }
    },
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
        },
      },
    );
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboardFiles = e.clipboardData?.files;
    if (clipboardFiles && clipboardFiles.length > 0) {
      const newFiles = new DataTransfer();
      if (files) {
        Array.from(files).forEach((f) => newFiles.items.add(f));
      }
      Array.from(clipboardFiles).forEach((f) => newFiles.items.add(f));
      setFiles(newFiles.files);
    }
  };

  if (!auth.user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col">
      <ChatHeader
        user={auth.user}
        onLogout={() => logout()}
        onClearChat={handleClearChat}
        messagesCount={messages.length}
      />

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
  );
}
