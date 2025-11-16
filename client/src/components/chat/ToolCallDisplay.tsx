import { CheckIcon, WrenchIcon, XIcon } from "lucide-react";

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface ToolResult {
  id: string;
  name: string;
  result: unknown;
}

interface ToolCallDisplayProps {
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

export function ToolCallDisplay({ toolCall, toolResult }: ToolCallDisplayProps) {
  if (!toolCall && !toolResult) return null;

  const isComplete = !!toolResult;
  const hasError = toolResult?.result?.error;

  return (
    <div className="border rounded-lg p-3 bg-muted/50 my-2">
      <div className="flex items-center gap-2 mb-2">
        <WrenchIcon size={16} className="text-muted-foreground" />
        <span className="font-medium text-sm">{toolCall?.name || toolResult?.name}</span>
        {isComplete &&
          (hasError ? (
            <XIcon size={14} className="text-destructive" />
          ) : (
            <CheckIcon size={14} className="text-green-600" />
          ))}
      </div>

      {toolCall?.args && Object.keys(toolCall.args).length > 0 && (
        <div className="text-xs text-muted-foreground mb-2">
          <strong>Input:</strong> {JSON.stringify(toolCall.args, null, 2)}
        </div>
      )}

      {toolResult && (
        <div className="text-xs">
          <strong className={hasError ? "text-destructive" : "text-green-600"}>
            {hasError ? "Error:" : "Result:"}
          </strong>
          <pre className="mt-1 whitespace-pre-wrap">{JSON.stringify(toolResult.result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
