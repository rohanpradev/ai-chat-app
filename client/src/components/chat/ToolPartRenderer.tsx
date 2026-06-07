import type { MyUIMessage } from "@chat-app/shared";
import type { ChatAddToolApproveResponseFunction } from "ai";
import { useCallback, useEffect, useState } from "react";
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from "@/components/ai-elements/confirmation";
import { Loader } from "@/components/ai-elements/loader";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import SerperResults from "@/components/chat/SerperResults";

type ChatMessagePart = MyUIMessage["parts"][number];
type ToolMessagePart = Extract<ChatMessagePart, { type: "tool-deepSearch" | "tool-serper" }>;
type ApprovalRequestedToolPart = Extract<ToolMessagePart, { state: "approval-requested" }>;
type ToolPartState = ToolMessagePart["state"];

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

const toolStateDescriptions: Partial<Record<ToolPartState, string>> = {
  "approval-responded": "Approval sent. The assistant can continue this turn with the approved decision.",
  "input-available": "Tool parameters are ready and execution is in progress.",
  "input-streaming": "Receiving streamed tool parameters from the model.",
};

function ToolStateNotice({ state }: Readonly<{ state: ToolPartState }>) {
  const description = toolStateDescriptions[state];

  if (!description) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3 text-muted-foreground text-sm">
      <Loader className="shrink-0" size={14} />
      <span>{description}</span>
    </div>
  );
}

export default function ToolPartRenderer({ part, onToolApprovalResponse }: Readonly<ToolPartRendererProps>) {
  const approvalId = part.state === "approval-requested" ? part.approval?.id : undefined;
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);
  const isApprovalPending = Boolean(approvalId && pendingApprovalId === approvalId);

  useEffect(() => {
    if (pendingApprovalId && (part.state !== "approval-requested" || part.approval?.id !== pendingApprovalId)) {
      setPendingApprovalId(null);
    }
  }, [part.approval?.id, part.state, pendingApprovalId]);

  const respondToApproval = useCallback(
    async (approved: boolean) => {
      if (!approvalId || isApprovalPending || !onToolApprovalResponse) {
        return;
      }

      setPendingApprovalId(approvalId);

      try {
        await onToolApprovalResponse({
          approved,
          id: approvalId,
        });
      } catch (error) {
        setPendingApprovalId(null);
        throw error;
      }
    },
    [approvalId, isApprovalPending, onToolApprovalResponse],
  );

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
                disabled={isApprovalPending || !onToolApprovalResponse}
                variant="outline"
                onClick={() => void respondToApproval(false)}
              >
                Deny
              </ConfirmationAction>
              <ConfirmationAction
                disabled={isApprovalPending || !onToolApprovalResponse}
                onClick={() => void respondToApproval(true)}
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

        <ToolStateNotice state={part.state} />

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
