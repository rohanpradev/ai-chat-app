import type { MyUIMessage } from "@chat-app/shared";
import { CopyIcon, RefreshCcwIcon } from "lucide-react";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { ErrorDisplay } from "@/components/chat/ErrorDisplay";
import { MessagePart } from "@/components/chat/MessagePart";

interface ChatMessagesProps {
  messages: MyUIMessage[];
  status: "submitted" | "streaming" | "ready" | "error";
  error?: Error;
  onRetry?: () => void;
  onClearError?: () => void;
  onRegenerate?: () => void;
}

export function ChatMessages({ messages, status, error, onRetry, onClearError, onRegenerate }: ChatMessagesProps) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getTextFromMessage = (message: MyUIMessage): string => {
    return (
      message.parts
        ?.filter((part) => part.type === "text")
        .map((part) => ("text" in part ? part.text : ""))
        .join(" ") || ""
    );
  };
  return (
    <>
      {messages.length === 0 && (
        <div className="text-center font-semibold mt-8">
          <p className="text-3xl mt-4">What can I help you with today?</p>
        </div>
      )}
      {messages.map((message, messageIndex) => {
        const isLastMessage = messageIndex === messages.length - 1;
        const messageText = getTextFromMessage(message);

        return (
          <Message key={message.id} from={message.role}>
            <MessageContent>
              {message.parts?.map((part, i) => (
                <MessagePart
                  key={`${message.id}-${i}`}
                  part={part}
                  messageId={message.id}
                  index={i}
                  isStreaming={status === "streaming"}
                />
              ))}
              {message.role === "assistant" && isLastMessage && messageText && (
                <Actions className="mt-2">
                  {onRegenerate && (
                    <Action onClick={onRegenerate} label="Regenerate">
                      <RefreshCcwIcon className="size-3" />
                    </Action>
                  )}
                  <Action onClick={() => copyToClipboard(messageText)} label="Copy">
                    <CopyIcon className="size-3" />
                  </Action>
                </Actions>
              )}
            </MessageContent>
          </Message>
        );
      })}
      {(status === "submitted" || status === "streaming") && (
        <Message from="assistant">
          <MessageContent>
            <div className="flex items-center gap-2">
              <Loader />
              Thinking...
            </div>
          </MessageContent>
        </Message>
      )}
      {error && onRetry && onClearError && (
        <div className="px-4">
          <ErrorDisplay error={error} onRetry={onRetry} onClear={onClearError} />
        </div>
      )}
    </>
  );
}
