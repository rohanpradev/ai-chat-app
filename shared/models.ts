export const providers = ["openai"] as const;

export type AIProvider = (typeof providers)[number];

export type AIModelId = string;

export interface AIModelDefinition {
	created?: number;
	id: AIModelId;
	name: string;
	ownedBy?: string;
	provider: AIProvider;
	source?: "api" | "fallback";
}

export const modelCatalog: AIModelDefinition[] = [
	{
		id: "gpt-5-mini",
		name: "GPT-5 Mini",
		provider: "openai",
		source: "fallback",
	},
];

export const modelIds = modelCatalog.map((model) => model.id);
export const defaultModelId: AIModelId = modelCatalog[0]?.id ?? "gpt-5-mini";

const modelLookup = new Map<string, AIModelDefinition>(modelCatalog.map((model) => [model.id, model]));

export const models: AIModelDefinition[] = [...modelCatalog];

export const getModelById = (id: string | undefined): AIModelDefinition | undefined =>
	id ? modelLookup.get(id) : undefined;

export const getModelsByProvider = (provider: AIProvider): AIModelDefinition[] =>
	modelCatalog.filter((model) => model.provider === provider);
