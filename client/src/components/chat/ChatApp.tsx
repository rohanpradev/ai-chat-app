import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Suggestion, Suggestions } from "@/components/ai-elements/suggestion";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useUserLogout } from "@/composables/useLogout";
import { useAgentChat } from "@/hooks/useAgentChat";

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

export function ChatApp({ user }: Readonly<ChatAppProps>) {
  const { mutate: logout } = useUserLogout();
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
    sendMessage,
    sendPromptMessage,
    setAgentMode,
    setInput,
    setModel,
    setWebSearch,
    showAgentGuide,
    status,
    webSearch,
  } = useAgentChat({});

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage({
      role: "user",
      parts: [{ type: "text", text: suggestion }],
    });
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
                onToolApprovalResponse={addToolApprovalResponse}
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
        </div>
      </div>
    </SidebarProvider>
  );
}
