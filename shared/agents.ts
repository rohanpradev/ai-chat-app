export const agentModeCatalog = [
	{
		description: "General-purpose agent for everyday chat, explanation, and tool-assisted answers.",
		id: "assistant",
		instructions:
			"Use this for everyday chat, practical help, and concise answers. It focuses on clarity and direct responses.",
		name: "Assistant",
	},
	{
		description: "Research-focused agent for multi-step investigation and synthesis.",
		id: "research",
		instructions:
			"Use this for deeper analysis, synthesis, and verification-heavy tasks. It is designed to break work into steps and build a tighter final answer.",
		name: "Research",
	},
] as const;

export type AgentMode = (typeof agentModeCatalog)[number]["id"];
export type AgentModeDefinition = (typeof agentModeCatalog)[number];

export const agentModeIds = agentModeCatalog.map((agentMode) => agentMode.id) as [AgentMode, ...AgentMode[]];
export const defaultAgentMode: AgentMode = agentModeCatalog[0].id;

const agentModeLookup = new Map<string, AgentModeDefinition>(
	agentModeCatalog.map((agentMode) => [agentMode.id, agentMode]),
);

export const agentModes = [...agentModeCatalog];

export const getAgentModeById = (id: string | undefined): AgentModeDefinition | undefined =>
	id ? agentModeLookup.get(id) : undefined;
