import type { MyUIMessage } from "@chat-app/shared";
import type { ChatAddToolApproveResponseFunction } from "ai";
import { lazy, memo, Suspense } from "react";

const LazyToolPart = lazy(() => import("@/components/chat/ToolPartRenderer"));

interface MessagePartProps {
  isStreaming?: boolean;
  part: MyUIMessage["parts"][number];
  messageId: string;
  index: number;
  onToolApprovalResponse?: ChatAddToolApproveResponseFunction;
}

function MessagePartComponent({ part, messageId, index, onToolApprovalResponse }: Readonly<MessagePartProps>) {
  switch (part.type) {
    case "step-start":
      return index > 0 ? (
        <div aria-hidden="true" key={`${messageId}-${index}`} className="my-2 h-px bg-border" />
      ) : null;
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

export const MessagePart = memo(MessagePartComponent, (previous, next) => {
  return (
    previous.index === next.index &&
    previous.isStreaming === next.isStreaming &&
    previous.messageId === next.messageId &&
    previous.onToolApprovalResponse === next.onToolApprovalResponse &&
    previous.part === next.part
  );
});
