import { useChat } from "@ai-sdk/react";
import type { MyUIMessage } from "@chat-app/shared";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { DefaultChatTransport } from "ai";
import type { ClipboardEvent } from "react";
import { useCallback, useMemo, useReducer } from "react";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatNotFound } from "@/components/errors/ChatNotFound";
import { getChatQuery } from "@/queries/getChat";
import { models } from "@/utils";
import { convertFilesToDataURLs } from "@/utils/fileUtils";

interface ChatState {
  input: string;
  model: string;
  webSearch: boolean;
  selectedTools: string[];
  files: FileList | undefined;
}

type ChatAction =
  | { type: "SET_INPUT"; payload: string }
  | { type: "SET_MODEL"; payload: string }
  | { type: "SET_WEB_SEARCH"; payload: boolean }
  | { type: "SET_TOOLS"; payload: string[] }
  | { type: "SET_FILES"; payload: FileList | undefined }
  | { type: "RESET_INPUT" };

const initialState: ChatState = {
  input: "",
  model: models[0].id,
  webSearch: false,
  selectedTools: [],
  files: undefined,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.payload };
    case "SET_MODEL":
      return { ...state, model: action.payload };
    case "SET_WEB_SEARCH":
      return { ...state, webSearch: action.payload };
    case "SET_TOOLS":
      return { ...state, selectedTools: action.payload };
    case "SET_FILES":
      return { ...state, files: action.payload };
    case "RESET_INPUT":
      return { ...state, input: "", files: undefined };
    default:
      return state;
  }
}

export const Route = createFileRoute("/chat/$conversationId")({
  loader: async ({ context, params }) => {
    const chatQuery = getChatQuery(params.conversationId);

    try {
      const result = await context.queryClient.ensureQueryData(chatQuery);

      if (!result.data) {
        throw notFound();
      }

      const messages = result.data.messages || [];
      const initialMessages: MyUIMessage[] = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        parts: msg.parts,
      }));

      return {
        initialMessages,
        chatId: params.conversationId,
      };
    } catch (error) {
      console.error("Failed to load chat:", error);
      throw notFound();
    }
  },
  component: ChatComponent,
  errorComponent: ChatNotFound,
});

function ChatComponent() {
  const { initialMessages, chatId } = Route.useLoaderData();
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Memoize transport to prevent recreation on every render
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/ai/text-stream",
        body: { chatId },
        credentials: "include",
      }),
    [chatId],
  );

  const { messages, sendMessage, status, error, regenerate } = useChat({
    transport,
    messages: initialMessages,
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (state.input.trim()) {
        const fileParts = state.files && state.files.length > 0 ? await convertFilesToDataURLs(state.files) : [];

        sendMessage(
          {
            role: "user",
            parts: [{ type: "text", text: state.input }, ...fileParts],
          },
          {
            body: {
              model: state.model,
              webSearch: state.webSearch,
              tools: state.selectedTools,
            },
          },
        );
        dispatch({ type: "RESET_INPUT" });
      }
    },
    [state.input, state.files, state.model, state.webSearch, state.selectedTools, sendMessage],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLTextAreaElement>) => {
      const clipboardFiles = e.clipboardData?.files;
      if (clipboardFiles && clipboardFiles.length > 0) {
        const newFiles = new DataTransfer();
        if (state.files) {
          Array.from(state.files).forEach((f) => {
            newFiles.items.add(f);
          });
        }
        Array.from(clipboardFiles).forEach((f) => {
          newFiles.items.add(f);
        });
        dispatch({ type: "SET_FILES", payload: newFiles.files });
      }
    },
    [state.files],
  );

  return (
    <>
      <Conversation className="flex-1">
        <ConversationContent className="pb-6">
          <ChatMessages
            messages={messages}
            status={status}
            error={error}
            onRetry={() => regenerate()}
            onClearError={() => {}}
            onRegenerate={() => regenerate()}
          />
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t p-6">
        <ChatInput
          input={state.input}
          setInput={(value) => dispatch({ type: "SET_INPUT", payload: value })}
          model={state.model}
          setModel={(value) => dispatch({ type: "SET_MODEL", payload: value })}
          webSearch={state.webSearch}
          setWebSearch={(value) => dispatch({ type: "SET_WEB_SEARCH", payload: value })}
          selectedTools={state.selectedTools}
          setSelectedTools={(value) => dispatch({ type: "SET_TOOLS", payload: value })}
          files={state.files}
          setFiles={(value) => dispatch({ type: "SET_FILES", payload: value })}
          onSubmit={handleSubmit}
          onPaste={handlePaste}
          status={status}
        />
      </div>
    </>
  );
}
