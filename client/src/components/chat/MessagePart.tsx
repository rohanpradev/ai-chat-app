import type { MyUIMessage } from "@chat-app/shared";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";
import { Response } from "@/components/ai-elements/response";
import { Source, Sources, SourcesContent, SourcesTrigger } from "@/components/ai-elements/source";
import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "@/components/ai-elements/task";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { SerperResults } from "@/components/chat/SerperResults";

interface MessagePartProps {
  part: MyUIMessage["parts"][0];
  messageId: string;
  index: number;
  isStreaming?: boolean;
}

export function MessagePart({ part, messageId, index, isStreaming = false }: MessagePartProps) {
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
    case "task":
      return (
        <Task key={`${messageId}-${index}`}>
          <TaskTrigger title={part.title || "Task"} />
          <TaskContent>
            {part.items?.map((item: { type?: string; text?: string; file?: { name?: string } }, itemIndex: number) => (
              <TaskItem key={`task-item-${itemIndex}`}>
                {item.type === "file" && item.file ? (
                  <span className="inline-flex items-center gap-1">
                    {item.text}
                    <TaskItemFile>
                      <span>{item.file.name}</span>
                    </TaskItemFile>
                  </span>
                ) : (
                  item.text || ""
                )}
              </TaskItem>
            ))}
          </TaskContent>
        </Task>
      );
    case "source-url":
      return (
        <Sources key={`${messageId}-${index}`}>
          <SourcesTrigger count={1} />
          <SourcesContent>
            <Source href={part.url} title={part.title || new URL(part.url).hostname} />
          </SourcesContent>
        </Sources>
      );
    case "source-document":
      return (
        <Sources key={`${messageId}-${index}`}>
          <SourcesTrigger count={1} />
          <SourcesContent>
            <Source href="#" title={part.title || `Document ${part.id}`} />
          </SourcesContent>
        </Sources>
      );
    case "reasoning":
      return (
        <Reasoning key={`${messageId}-${index}`} isStreaming={isStreaming}>
          <ReasoningTrigger />
          <ReasoningContent>{part.text}</ReasoningContent>
        </Reasoning>
      );
    default:
      return null;
  }
}
