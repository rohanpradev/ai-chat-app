import type { MyUIMessage } from "@chat-app/shared";
import type { ChatAddToolApproveResponseFunction } from "ai";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import { MessageResponse } from "@/components/ai-elements/message";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { SerperResults } from "@/components/chat/SerperResults";

interface MessagePartProps {
  part: MyUIMessage["parts"][number];
  messageId: string;
  index: number;
  onToolApprovalResponse?: ChatAddToolApproveResponseFunction;
}

const getToolApprovalPrompt = (
  part: Extract<MyUIMessage["parts"][number], { state: "approval-requested"; type: `tool-${string}` }>,
) => {
  switch (part.type) {
    case "tool-serper":
      return `Allow web search for "${part.input.q}"?`;
    case "tool-deepSearch":
      return `Allow deep search for "${part.input.query}"?`;
    default:
      return "Allow this tool call?";
  }
};

export function MessagePart({ part, messageId, index, onToolApprovalResponse }: Readonly<MessagePartProps>) {
  switch (part.type) {
    case "text":
      return <MessageResponse key={`${messageId}-${index}`}>{part.text}</MessageResponse>;
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
          Attachment: {part.mediaType}
        </div>
      );
    case "tool-deepSearch":
    case "tool-serper":
      return (
        <Tool defaultOpen={part.state !== "output-available"} key={`${messageId}-${index}`}>
          <ToolHeader type={part.type} state={part.state} />
          <ToolContent>
            <Confirmation approval={part.approval} state={part.state}>
              <ConfirmationRequest>
                <ConfirmationTitle>
                  {part.state === "approval-requested" ? getToolApprovalPrompt(part) : "Allow this tool call?"}
                </ConfirmationTitle>
                <ConfirmationActions>
                  <ConfirmationAction
                    variant="outline"
                    onClick={() =>
                      part.approval &&
                      onToolApprovalResponse?.({
                        approved: false,
                        id: part.approval.id,
                      })
                    }
                  >
                    Deny
                  </ConfirmationAction>
                  <ConfirmationAction
                    onClick={() =>
                      part.approval &&
                      onToolApprovalResponse?.({
                        approved: true,
                        id: part.approval.id,
                      })
                    }
                  >
                    Approve
                  </ConfirmationAction>
                </ConfirmationActions>
              </ConfirmationRequest>
              <ConfirmationAccepted>
                <ConfirmationTitle>Tool execution approved.</ConfirmationTitle>
              </ConfirmationAccepted>
              <ConfirmationRejected>
                <ConfirmationTitle>Tool execution denied.</ConfirmationTitle>
              </ConfirmationRejected>
            </Confirmation>
            {(part.state === "approval-requested" ||
              part.state === "approval-responded" ||
              part.state === "input-streaming" ||
              part.state === "input-available") && <ToolInput input={part.input} />}
            {part.state === "output-available" &&
              (part.type === "tool-serper" ? (
                <div className="p-4">
                  <SerperResults data={part.output} />
                </div>
              ) : (
                <ToolOutput output={part.output} errorText={undefined} />
              ))}
            {part.state === "output-error" && <ToolOutput output={undefined} errorText={part.errorText} />}
            {part.state === "output-denied" && <ToolOutput output={undefined} errorText="Tool execution was denied." />}
          </ToolContent>
        </Tool>
      );
    default:
      return null;
  }
}
