import type { MyUIMessage } from "@chat-app/shared";
import { Response } from "@/components/ai-elements/response";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { SerperResults } from "@/components/chat/SerperResults";

interface MessagePartProps {
  part: MyUIMessage["parts"][0];
  messageId: string;
  index: number;
}

export function MessagePart({ part, messageId, index }: MessagePartProps) {
  switch (part.type) {
    case "text":
      return <Response key={`${messageId}-${index}`}>{part.text}</Response>;
    case "file":
      if (part.mediaType?.startsWith("image/")) {
        return <img key={`${messageId}-${index}`} src={part.url} alt="attachment" className="max-w-sm rounded" />;
      }
      if (part.mediaType === "application/pdf") {
        return (
          <iframe key={`${messageId}-${index}`} src={part.url} className="w-full h-96 rounded" title="PDF attachment" />
        );
      }
      return (
        <div key={`${messageId}-${index}`} className="text-sm text-muted-foreground">
          📎 {part.mediaType}
        </div>
      );
    case "tool-deepSearch":
    case "tool-serper":
      return (
        <Tool key={`${messageId}-${index}`}>
          <ToolHeader type={part.type} state={part.state} />
          <ToolContent>
            {(part.state === "input-streaming" || part.state === "input-available") && <ToolInput input={part.input} />}
            {part.state === "output-available" &&
              (part.type === "tool-serper" ? (
                <div className="p-4">
                  <SerperResults data={part.output as Record<string, unknown>} />
                </div>
              ) : (
                <ToolOutput output={JSON.stringify(part.output, null, 2)} errorText={undefined} />
              ))}
            {part.state === "output-error" && <ToolOutput output={undefined} errorText={part.errorText} />}
          </ToolContent>
        </Tool>
      );
    default:
      return null;
  }
}
