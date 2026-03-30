import {
	type AgentMode,
	defaultAgentMode,
	defaultModelId,
	type EnabledRequestToolId,
	enabledRequestToolIds,
	getAgentModeById,
	uiMessageTools
} from "@chat-app/shared";
import { stepCountIs, ToolLoopAgent, type ToolSet } from "ai";
import { z } from "zod";
import { executableTools, getActiveTools } from "@/lib/tools";
import { resolveModel, resolveModelSelection } from "@/utils/index";

const agentTools = {
	...uiMessageTools,
	serper: executableTools.serper
} satisfies ToolSet;

const agentCallOptionsSchema = z.object({
	conversationId: z.string().optional(),
	requestedModel: z.string().optional(),
	toolNames: z.array(z.enum(enabledRequestToolIds)).default([]),
	userId: z.string()
});

type AgentCallOptions = z.infer<typeof agentCallOptionsSchema>;
type ChatAgent = ToolLoopAgent<AgentCallOptions, typeof agentTools>;

interface ChatAgentProfile {
	baseInstructions: readonly string[];
	functionId: string;
	stepLimit: number;
}

const agentProfiles: Record<AgentMode, ChatAgentProfile> = {
	assistant: {
		baseInstructions: [
			"You are a helpful assistant for a chat application.",
			"Be concise, direct, and accurate.",
			"If a tool execution is denied or unavailable, explain that and continue without retrying the same tool unless the user asks again."
		],
		functionId: "ai-agent-assistant",
		stepLimit: 5
	},
	research: {
		baseInstructions: [
			"You are a research-focused assistant for a chat application.",
			"Break larger tasks into a short plan, verify claims before stating them confidently, and synthesize findings clearly.",
			"When current information is needed and a live tool is available, prefer using the tool before answering.",
			"If a tool execution is denied or unavailable, explain the limitation and continue with the best offline answer you can provide."
		],
		functionId: "ai-agent-research",
		stepLimit: 8
	}
};

const buildToolAvailabilityGuidance = (toolNames: EnabledRequestToolId[]) =>
	toolNames.includes("serper")
		? "Live web search is available in this turn. Use it when the user asks for recent or verifiable information, and rely on the returned results rather than guessing."
		: "Live web search is not available in this turn. Do not claim to have checked the web.";

const buildAgentInstructions = (baseInstructions: readonly string[], toolNames: EnabledRequestToolId[]) =>
	[...baseInstructions, buildToolAvailabilityGuidance(toolNames)].join("\n\n");

const createChatAgent = ({ baseInstructions, functionId, stepLimit }: ChatAgentProfile): ChatAgent =>
	new ToolLoopAgent<AgentCallOptions, typeof agentTools>({
		callOptionsSchema: agentCallOptionsSchema,
		instructions: buildAgentInstructions(baseInstructions, []),
		model: resolveModel(defaultModelId),
		prepareCall: async ({ options, ...settings }) => {
			const activeTools = getActiveTools(options.toolNames);
			const resolvedModel = await resolveModelSelection(options.requestedModel);

			return {
				...settings,
				activeTools,
				experimental_telemetry: {
					functionId,
					isEnabled: true,
					metadata: {
						userId: options.userId,
						...(options.conversationId ? { sessionId: options.conversationId } : {}),
						model: resolvedModel.id,
						requestedModel: options.requestedModel ?? resolvedModel.id,
						tags: ["chat", "agent", functionId, resolvedModel.id, resolvedModel.provider],
						toolCount: activeTools.length,
						...(activeTools.length > 0 ? { tools: activeTools.join(",") } : {})
					}
				},
				instructions: buildAgentInstructions(baseInstructions, activeTools),
				model: resolveModel(resolvedModel.id)
			};
		},
		stopWhen: stepCountIs(stepLimit),
		tools: agentTools
	});

const agentFactories: Record<AgentMode, () => ChatAgent> = {
	assistant: () => createChatAgent(agentProfiles.assistant),
	research: () => createChatAgent(agentProfiles.research)
};

const agentCache = new Map<AgentMode, ChatAgent>();

export const resolveAgentMode = (requestedMode?: string): AgentMode =>
	getAgentModeById(requestedMode)?.id ?? defaultAgentMode;

export const getChatAgent = (mode: AgentMode = defaultAgentMode): ChatAgent => {
	const cachedAgent = agentCache.get(mode);
	if (cachedAgent) {
		return cachedAgent;
	}

	const agent = agentFactories[mode]();
	agentCache.set(mode, agent);
	return agent;
};

export type { AgentCallOptions };
