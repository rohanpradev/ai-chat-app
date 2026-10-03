export const providers = ["vercel-ai-gateway"] as const;

export type AIProvider = (typeof providers)[number];

export type AIModelId = string;

export interface AIModelDefinition {
	created?: number;
	id: AIModelId;
	name: string;
	ownedBy?: string;
	provider: AIProvider;
	source?: "api" | "fallback" | "override";
}

export const modelCatalog: AIModelDefinition[] = [
	{
		id: "openai/gpt-5-mini",
		name: "GPT-5 Mini",
		provider: "vercel-ai-gateway",
		source: "fallback",
	},
];

export const modelIds = modelCatalog.map((model) => model.id);
export const defaultModelId: AIModelId = modelCatalog[0]?.id ?? "openai/gpt-5-mini";

const modelLookup = new Map<string, AIModelDefinition>(modelCatalog.map((model) => [model.id, model]));

export const models: AIModelDefinition[] = [...modelCatalog];

export const getModelById = (id: string | undefined): AIModelDefinition | undefined =>
	id ? modelLookup.get(id) : undefined;

export const getModelsByProvider = (provider: AIProvider): AIModelDefinition[] =>
	modelCatalog.filter((model) => model.provider === provider);

export const isAvailableModelId = (id: string, availableModels: readonly AIModelDefinition[]): id is AIModelId =>
	availableModels.some((model) => model.id === id);
