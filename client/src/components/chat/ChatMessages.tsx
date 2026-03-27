import type { MyUIMessage } from "@chat-app/shared";
import type { ChatAddToolApproveResponseFunction, ChatStatus } from "ai";
import { FileTextIcon } from "lucide-react";

import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { ErrorDisplay } from "@/components/chat/ErrorDisplay";
import { MessagePart } from "@/components/chat/MessagePart";

interface ChatMessagesProps {
  messages: MyUIMessage[];
  status: ChatStatus;
  error?: Error;
  onRetry?: () => void;
  onClearError?: () => void;
  onToolApprovalResponse?: ChatAddToolApproveResponseFunction;
}

type ChatMessagePart = MyUIMessage["parts"][number];
type ReasoningPart = Extract<ChatMessagePart, { type: "reasoning" }>;
type SourcePart = Extract<ChatMessagePart, { type: "source-document" | "source-url" }>;

const isReasoningPart = (part: ChatMessagePart): part is ReasoningPart => part.type === "reasoning";

const isSourcePart = (part: ChatMessagePart): part is SourcePart =>
  part.type === "source-document" || part.type === "source-url";

const getPartBaseKey = (messageId: string, part: ChatMessagePart) => {
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

const getRenderableParts = (messageId: string, parts: ChatMessagePart[]) => {
  const perMessageKeyCount = new Map<string, number>();

  return parts.map((part: ChatMessagePart, index: number) => {
    const baseKey = getPartBaseKey(messageId, part);
    const seenCount = perMessageKeyCount.get(baseKey) ?? 0;
    perMessageKeyCount.set(baseKey, seenCount + 1);

    return {
      index,
      key: seenCount === 0 ? baseKey : `${baseKey}:${seenCount}`,
      part,
    };
  });
};

export function ChatMessages({
  messages,
  status,
  error,
  onRetry,
  onClearError,
  onToolApprovalResponse,
}: Readonly<ChatMessagesProps>) {
  return (
    <>
      {messages.length === 0 && (
        <div className="text-center font-semibold mt-8">
          <p className="text-3xl mt-4">What can I help you with today?</p>
        </div>
      )}
      {messages.map((message) => {
        const reasoningParts = message.parts.filter(isReasoningPart);
        const sourceParts = message.parts.filter(isSourcePart);
        const visibleParts = message.parts.filter(
          (part: ChatMessagePart) => !isReasoningPart(part) && !isSourcePart(part),
        );
        const reasoningText = reasoningParts
          .map((part: ReasoningPart) => part.text)
          .join("\n\n")
          .trim();

        return (
          <Message key={message.id} from={message.role}>
            <MessageContent>
              {reasoningText ? (
                <Reasoning isStreaming={reasoningParts.some((part: ReasoningPart) => part.state !== "done")}>
                  <ReasoningTrigger />
                  <ReasoningContent>{reasoningText}</ReasoningContent>
                </Reasoning>
              ) : null}
              {getRenderableParts(message.id, visibleParts).map(({ index, key, part }) => (
                <MessagePart
                  key={key}
                  part={part}
                  messageId={message.id}
                  index={index}
                  onToolApprovalResponse={onToolApprovalResponse}
                />
              ))}
              {sourceParts.length > 0 ? (
                <Sources>
                  <SourcesTrigger count={sourceParts.length} />
                  <SourcesContent>
                    {sourceParts.map((part: SourcePart) =>
                      part.type === "source-url" ? (
                        <Source href={part.url} key={`${part.type}:${part.sourceId}`} title={part.title ?? part.url} />
                      ) : (
                        <div className="flex items-center gap-2 text-primary" key={`${part.type}:${part.sourceId}`}>
                          <FileTextIcon className="h-4 w-4" />
                          <div className="flex flex-col">
                            <span className="font-medium">{part.title}</span>
                            <span className="text-muted-foreground text-xs">{part.filename ?? part.mediaType}</span>
                          </div>
                        </div>
                      ),
                    )}
                  </SourcesContent>
                </Sources>
              ) : null}
            </MessageContent>
          </Message>
        );
      })}
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
