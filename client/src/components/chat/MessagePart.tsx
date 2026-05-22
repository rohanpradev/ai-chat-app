import type { MyUIMessage } from "@chat-app/shared";
import type { ChatAddToolApproveResponseFunction } from "ai";
import { lazy, Suspense } from "react";

const LazyToolPart = lazy(() => import("@/components/chat/ToolPartRenderer"));

const LazyMessageResponse = lazy(async () => {
  const { MessageResponse } = await import("@/components/ai-elements/message");
  return { default: MessageResponse };
});

interface MessagePartProps {
  isStreaming?: boolean;
  part: MyUIMessage["parts"][number];
  messageId: string;
  index: number;
  onToolApprovalResponse?: ChatAddToolApproveResponseFunction;
}

export function MessagePart({
  isStreaming = false,
  part,
  messageId,
  index,
  onToolApprovalResponse,
}: Readonly<MessagePartProps>) {
  switch (part.type) {
    case "text":
      return (
        <Suspense fallback={<div className="whitespace-pre-wrap">{part.text}</div>} key={`${messageId}-${index}`}>
          <LazyMessageResponse isAnimating={isStreaming}>{part.text}</LazyMessageResponse>
        </Suspense>
      );
    case "file":
      if (part.mediaType?.startsWith("image/")) {
        return (
          <img
            key={`${messageId}-${index}`}
            src={part.url}
            alt="attachment"
            className="max-w-sm rounded"
            decoding="async"
            loading="lazy"
          />
        );
      }
      if (part.mediaType === "application/pdf") {
        return (
          <iframe key={`${messageId}-${index}`} src={part.url} className="w-full h-96 rounded" title="PDF attachment" />
        );
      }
      return (
        <div key={`${messageId}-${index}`} className="text-sm text-muted-foreground">
          Attachment: {part.mediaType}
        </div>
      );
    case "tool-deepSearch":
    case "tool-serper":
      return (
        <Suspense
          fallback={
            <div className="rounded-md border bg-muted/50 p-3 text-muted-foreground text-sm">
              Loading tool output...
            </div>
          }
          key={`${messageId}-${index}`}
        >
          <LazyToolPart part={part} onToolApprovalResponse={onToolApprovalResponse} />
        </Suspense>
      );
    default:
      return null;
  }
}
