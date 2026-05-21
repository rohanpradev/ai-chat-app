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
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import SerperResults from "@/components/chat/SerperResults";

type ChatMessagePart = MyUIMessage["parts"][number];
type ToolMessagePart = Extract<ChatMessagePart, { type: "tool-deepSearch" | "tool-serper" }>;
type ApprovalRequestedToolPart = Extract<ToolMessagePart, { state: "approval-requested" }>;

interface ToolPartRendererProps {
  onToolApprovalResponse?: ChatAddToolApproveResponseFunction;
  part: ToolMessagePart;
}

const getToolApprovalPrompt = (part: ApprovalRequestedToolPart) => {
  switch (part.type) {
    case "tool-serper":
      return `Allow web search for "${part.input.q}"?`;
    case "tool-deepSearch":
      return `Allow deep search for "${part.input.query}"?`;
  }
};

export default function ToolPartRenderer({ part, onToolApprovalResponse }: Readonly<ToolPartRendererProps>) {
  return (
    <Tool defaultOpen={part.state !== "output-available"}>
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
}
