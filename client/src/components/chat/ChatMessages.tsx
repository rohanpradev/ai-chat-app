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

export function ChatMessages({ messages, status, error, onRetry, onClearError }: ChatMessagesProps) {
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
            {message.parts?.map((part, i) => (
              <MessagePart key={`${message.id}-${i}`} part={part} messageId={message.id} index={i} />
            ))}
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
          <ErrorDisplay error={error} onRetry={onRetry} onClear={onClearError} />
        </div>
      )}
    </>
  );
}
