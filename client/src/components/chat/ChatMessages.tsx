import type { MyUIMessage } from "@chat-app/shared";
import type { ChatStatus } from "ai";

import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { ErrorDisplay } from "@/components/chat/ErrorDisplay";
import { MessagePart } from "@/components/chat/MessagePart";

interface ChatMessagesProps {
  messages: MyUIMessage[];
  status: ChatStatus;
  error?: Error;
  onRetry?: () => void;
  onClearError?: () => void;
}

const getPartBaseKey = (
  messageId: string,
  part: MyUIMessage["parts"][number],
) => {
  const baseType = part.type;

  if ("toolCallId" in part && typeof part.toolCallId === "string") {
    return `${messageId}:${baseType}:${part.toolCallId}`;
  }

  if ("id" in part && typeof part.id === "string") {
    return `${messageId}:${baseType}:${part.id}`;
  }

  if ("text" in part && typeof part.text === "string") {
    return `${messageId}:${baseType}:${part.text.length}:${part.text.slice(0, 40)}`;
  }

  if ("url" in part && typeof part.url === "string") {
    return `${messageId}:${baseType}:${part.url}`;
  }

  return `${messageId}:${baseType}:${JSON.stringify(part)}`;
};

export function ChatMessages({
  messages,
  status,
  error,
  onRetry,
  onClearError,
}: ChatMessagesProps) {
  return (
    <>
      {messages.length === 0 && (
        <div className="text-center font-semibold mt-8">
          <p className="text-3xl mt-4">What can I help you with today?</p>
        </div>
      )}
      {messages.map((message) => (
        <Message key={message.id} from={message.role}>
          <MessageContent>
            {(() => {
              const perMessageKeyCount = new Map<string, number>();
              return message.parts?.map((part, i) => {
                const baseKey = getPartBaseKey(message.id, part);
                const seenCount = perMessageKeyCount.get(baseKey) ?? 0;
                perMessageKeyCount.set(baseKey, seenCount + 1);
                const key =
                  seenCount === 0 ? baseKey : `${baseKey}:${seenCount}`;
                return (
                  <MessagePart
                    key={key}
                    part={part}
                    messageId={message.id}
                    index={i}
                  />
                );
              });
            })()}
          </MessageContent>
        </Message>
      ))}
      {status === "submitted" && (
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
          <ErrorDisplay
            error={error}
            onRetry={onRetry}
            onClear={onClearError}
          />
        </div>
      )}
    </>
  );
}
