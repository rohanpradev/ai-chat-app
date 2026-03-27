import {
  type AgentMode,
  type AIModelDefinition,
  type AIModelId,
  getAgentModeById,
  getModelById,
  tools,
} from "@chat-app/shared";
import {
  Agent,
  AgentContent,
  AgentHeader,
  AgentInstructions,
  AgentTool,
  AgentTools,
} from "@/components/ai-elements/agent";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AgentModePanelProps {
  availableModels: AIModelDefinition[];
  agentMode: AgentMode;
  className?: string;
  model: AIModelId;
  webSearch: boolean;
}

export function AgentModePanel({
  availableModels,
  agentMode,
  className,
  model,
  webSearch,
}: Readonly<AgentModePanelProps>) {
  const agentDefinition = getAgentModeById(agentMode);
  const modelDefinition = availableModels.find((candidate) => candidate.id === model) ?? getModelById(model);

  if (!agentDefinition) {
    return null;
  }

  const instructionSummary = webSearch
    ? `${agentDefinition.instructions} Live web search is enabled for this turn.`
    : `${agentDefinition.instructions} Live web search is currently disabled, so the agent should rely on conversation context only.`;

  return (
    <Agent className={cn("bg-card/80 shadow-sm", className)}>
      <AgentHeader model={modelDefinition?.name ?? model} name={agentDefinition.name} />
      <AgentContent>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{agentDefinition.description}</Badge>
          <Badge variant={webSearch ? "default" : "outline"}>{webSearch ? "Web Search On" : "Web Search Off"}</Badge>
        </div>
        <AgentInstructions>{instructionSummary}</AgentInstructions>
        {webSearch ? (
          <AgentTools collapsible type="single">
            <AgentTool tool={tools.serper} value="serper" />
          </AgentTools>
        ) : (
          <div className="rounded-md border border-dashed px-3 py-2 text-muted-foreground text-sm">
            Enable Web Search to let this agent pull current information and cite fresh results.
          </div>
        )}
      </AgentContent>
    </Agent>
  );
}
