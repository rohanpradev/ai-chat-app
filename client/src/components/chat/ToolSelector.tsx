import { WrenchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const availableTools = [
  { id: "calculator", name: "Calculator", description: "Perform mathematical calculations" },
  { id: "getCurrentTime", name: "Current Time", description: "Get current date and time" },
  { id: "deepSearch", name: "Deep Search", description: "Advanced web search with filtering" },
  { id: "serper", name: "Serper Search", description: "Real-time web search via Serper API" },
];

interface ToolSelectorProps {
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
}

export function ToolSelector({ selectedTools, onToolsChange }: ToolSelectorProps) {
  const toggleTool = (toolId: string) => {
    if (selectedTools.includes(toolId)) {
      onToolsChange(selectedTools.filter((id) => id !== toolId));
    } else {
      onToolsChange([...selectedTools, toolId]);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={selectedTools.length > 0 ? "default" : "ghost"} size="sm">
          <WrenchIcon size={16} />
          <span>Tools {selectedTools.length > 0 && `(${selectedTools.length})`}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {availableTools.map((tool) => (
          <DropdownMenuCheckboxItem
            key={tool.id}
            checked={selectedTools.includes(tool.id)}
            onCheckedChange={() => toggleTool(tool.id)}
          >
            <div className="flex flex-col">
              <span className="font-medium">{tool.name}</span>
              <span className="text-xs text-muted-foreground">{tool.description}</span>
            </div>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
