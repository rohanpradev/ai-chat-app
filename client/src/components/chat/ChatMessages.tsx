import type { MyUIMessage } from "@chat-app/shared";
import type { ChatAddToolApproveResponseFunction, ChatStatus } from "ai";
import { CheckIcon, CopyIcon, FileTextIcon, MessageSquareIcon, RefreshCcwIcon } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";

import { ConversationEmptyState } from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@/components/ai-elements/message";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/sources";
import { ErrorDisplay } from "@/components/chat/ErrorDisplay";
import { MessagePart } from "@/components/chat/MessagePart";

interface ChatMessagesProps {
  messages: MyUIMessage[];
  status: ChatStatus;
  error?: Error;
  onRetry?: (messageId?: string) => void | Promise<void>;
  onClearError?: () => void;
  onToolApprovalResponse?: ChatAddToolApproveResponseFunction;
}

type ChatMessagePart = MyUIMessage["parts"][number];
type ReasoningPart = Extract<ChatMessagePart, { type: "reasoning" }>;
type SourcePart = Extract<ChatMessagePart, { type: "source-document" | "source-url" }>;

const LazyReasoningBlock = lazy(async () => {
  const { Reasoning, ReasoningContent, ReasoningTrigger } = await import("@/components/ai-elements/reasoning");

  return {
    default: ({ children, isStreaming }: { children: string; isStreaming: boolean }) => (
      <Reasoning isStreaming={isStreaming}>
        <ReasoningTrigger />
        <ReasoningContent>{children}</ReasoningContent>
      </Reasoning>
    ),
  };
});

const isReasoningPart = (part: ChatMessagePart): part is ReasoningPart => part.type === "reasoning";

const isSourcePart = (part: ChatMessagePart): part is SourcePart =>
  part.type === "source-document" || part.type === "source-url";

const getMessageText = (message: MyUIMessage) =>
  message.parts
    .filter((part): part is Extract<ChatMessagePart, { type: "text" }> => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

function MessageMetadata({ message }: Readonly<{ message: MyUIMessage }>) {
  const details = [
    message.metadata?.model,
    message.metadata?.totalTokens ? `${message.metadata.totalTokens.toLocaleString()} tokens` : undefined,
    message.metadata?.finishReason,
  ].filter(Boolean);

  if (details.length === 0) {
    return null;
  }

  return <div className="text-muted-foreground text-xs">{details.join(" · ")}</div>;
}

function MessageControls({
  canRegenerate,
  message,
  onRetry,
}: Readonly<{
  canRegenerate: boolean;
  message: MyUIMessage;
  onRetry?: (messageId?: string) => void | Promise<void>;
}>) {
  const messageText = useMemo(() => getMessageText(message), [message]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }

    const resetCopied = globalThis.setTimeout(() => setCopied(false), 1500);
    return () => globalThis.clearTimeout(resetCopied);
  }, [copied]);

  const copyMessage = useCallback(async () => {
    if (!messageText) {
      return;
    }

    await navigator.clipboard.writeText(messageText);
    setCopied(true);
  }, [messageText]);

  if (!messageText && !canRegenerate) {
    return null;
  }

  return (
    <MessageToolbar className="mt-1 justify-between opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
      <MessageMetadata message={message} />
      <MessageActions>
        {messageText ? (
          <MessageAction label="Copy" tooltip={copied ? "Copied" : "Copy"} onClick={() => void copyMessage()}>
            {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
          </MessageAction>
        ) : null}
        {canRegenerate ? (
          <MessageAction label="Regenerate" tooltip="Regenerate" onClick={() => void onRetry?.(message.id)}>
            <RefreshCcwIcon className="size-3" />
          </MessageAction>
        ) : null}
      </MessageActions>
    </MessageToolbar>
  );
}

const getPartBaseKey = (messageId: string, part: ChatMessagePart, index: number) => {
  const baseType = part.type;

  if ("toolCallId" in part && typeof part.toolCallId === "string") {
    return `${messageId}:${baseType}:${part.toolCallId}`;
  }

  if ("id" in part && typeof part.id === "string") {
    return `${messageId}:${baseType}:${part.id}`;
  }

  if ("text" in part && typeof part.text === "string") {
    return `${messageId}:${baseType}:${index}`;
  }

  if ("url" in part && typeof part.url === "string") {
    return `${messageId}:${baseType}:${part.url}`;
  }

  return `${messageId}:${baseType}:${index}`;
};

const getRenderableParts = (messageId: string, parts: ChatMessagePart[]) => {
  const perMessageKeyCount = new Map<string, number>();

  return parts.map((part: ChatMessagePart, index: number) => {
    const baseKey = getPartBaseKey(messageId, part, index);
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
        <ConversationEmptyState
          icon={<MessageSquareIcon className="size-10" />}
          title="What can I help you with today?"
          description="Start with a question, a file, or a research task."
          className="min-h-[40vh]"
        />
      )}
      {messages.map((message) => {
        const isStreamingMessage = status === "streaming" && message.role === "assistant";
        const canRegenerate = message.role === "assistant" && (status === "ready" || status === "error");
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
                <Suspense fallback={<div className="text-muted-foreground text-sm">{reasoningText}</div>}>
                  <LazyReasoningBlock
                    isStreaming={
                      isStreamingMessage && reasoningParts.some((part: ReasoningPart) => part.state !== "done")
                    }
                  >
                    {reasoningText}
                  </LazyReasoningBlock>
                </Suspense>
              ) : null}
              {getRenderableParts(message.id, visibleParts).map(({ index, key, part }) =>
                part.type === "text" ? (
                  <MessageResponse isAnimating={isStreamingMessage} key={key}>
                    {part.text}
                  </MessageResponse>
                ) : (
                  <MessagePart
                    key={key}
                    part={part}
                    messageId={message.id}
                    index={index}
                    isStreaming={isStreamingMessage}
                    onToolApprovalResponse={onToolApprovalResponse}
                  />
                ),
              )}
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
            {message.role === "assistant" ? (
              <MessageControls canRegenerate={canRegenerate} message={message} onRetry={onRetry} />
            ) : null}
          </Message>
        );
      })}
      {status === "submitted" && (
        <Message from="assistant">
          <MessageContent>
            <div className="flex items-center gap-2" role="status" aria-live="polite">
              <Loader />
              Waiting for the first token...
            </div>
          </MessageContent>
        </Message>
      )}
      {error && onRetry && onClearError && (
        <div className="px-4">
          <ErrorDisplay onRetry={() => void onRetry()} onClear={onClearError} />
        </div>
      )}
    </>
  );
}
