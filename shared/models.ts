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
		id: "gpt-5.4",
		name: "GPT-5.4",
		provider: "openai",
		source: "fallback",
	},
	{
		id: "gpt-5.4-mini",
		name: "GPT-5.4 Mini",
		provider: "openai",
		source: "fallback",
	},
	{
		id: "gpt-5.4-nano",
		name: "GPT-5.4 Nano",
		provider: "openai",
		source: "fallback",
	},
	{ id: "gpt-4.1", name: "GPT-4.1", provider: "openai", source: "fallback" },
	{ id: "gpt-4o", name: "GPT-4o", provider: "openai", source: "fallback" },
];

export const modelIds = modelCatalog.map((model) => model.id);
export const defaultModelId: AIModelId = modelCatalog[0]?.id ?? "gpt-5.4";

const modelLookup = new Map<string, AIModelDefinition>(modelCatalog.map((model) => [model.id, model]));

export const models: AIModelDefinition[] = [...modelCatalog];

export const getModelById = (id: string | undefined): AIModelDefinition | undefined =>
	id ? modelLookup.get(id) : undefined;

export const getModelsByProvider = (provider: AIProvider): AIModelDefinition[] =>
	modelCatalog.filter((model) => model.provider === provider);
