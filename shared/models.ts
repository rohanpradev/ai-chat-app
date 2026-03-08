export const providers = ["openai"] as const;

export type AIProvider = (typeof providers)[number];

export const modelCatalog = [
	{ id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" },
	{ id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "openai" },
	{ id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "openai" },
	{ id: "gpt-4o", name: "GPT-4o", provider: "openai" },
] as const satisfies readonly {
	id: string;
	name: string;
	provider: AIProvider;
}[];

export type AIModelId = (typeof modelCatalog)[number]["id"];
export type AIModelDefinition = (typeof modelCatalog)[number];

export const modelIds = modelCatalog.map((model) => model.id) as [AIModelId, ...AIModelId[]];

const modelLookup = new Map<string, AIModelDefinition>(modelCatalog.map((model) => [model.id, model]));

export const models = [...modelCatalog];

export const getModelById = (id: string | undefined): AIModelDefinition | undefined =>
	id ? modelLookup.get(id) : undefined;

export const getModelsByProvider = (provider: AIProvider): AIModelDefinition[] =>
	modelCatalog.filter((model) => model.provider === provider);
