import { type AIModelDefinition, defaultModelId, getModelById, getModelsByProvider } from "@chat-app/shared";
import env from "@/utils/env";

interface GatewayModelRecord {
	id: string;
	created?: number;
	owned_by?: string;
	type?: string;
}

interface GatewayModelListResponse {
	data: GatewayModelRecord[];
}

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const GATEWAY_MODELS_TIMEOUT_MS = 5000;
const gatewayProvider = "vercel-ai-gateway" as const;
const specializedModelPattern =
	/(?:^|[-/])(embedding|embed|rerank|image|video|transcri(?:be|ption)|speech|tts|audio)(?:[-/]|$)/i;

let cachedModelCatalog: { data: AIModelDefinition[]; expiresAt: number } | undefined;

const formatModelDisplayName = (id: string): string => {
	const modelName = id.split("/").at(-1) ?? id;
	const [first, second, ...rest] = modelName.split(/[-_]/).filter(Boolean);
	const firstPair = first?.toLowerCase() === "gpt" && second ? [`GPT-${second}`] : [first];
	const remainingParts = first?.toLowerCase() === "gpt" ? rest : [second, ...rest];
	return [...firstPair, ...remainingParts]
		.filter((part): part is string => Boolean(part))
		.map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
		.join(" ");
};

const formatProviderDisplayName = (providerId: string | undefined): string => {
	if (!providerId) return "Gateway";
	if (providerId === "openai") return "OpenAI";
	if (providerId === "xai") return "xAI";
	return providerId.replace(
		/(^|-)([a-z])/g,
		(_, separator: string, letter: string) => `${separator === "-" ? " " : ""}${letter.toUpperCase()}`
	);
};

export const filterAvailableChatModels = (models: readonly GatewayModelRecord[]): AIModelDefinition[] => {
	const catalog = new Map<string, AIModelDefinition>();
	for (const model of models) {
		if (!model.id || specializedModelPattern.test(model.id) || (model.type && model.type !== "language")) continue;
		catalog.set(model.id, {
			created: model.created,
			id: model.id,
			name: `${formatProviderDisplayName(model.owned_by)} · ${formatModelDisplayName(model.id)}`,
			ownedBy: model.owned_by,
			provider: gatewayProvider,
			source: "api"
		});
	}

	return [...catalog.values()].sort((left, right) => {
		if (left.id === defaultModelId) return -1;
		if (right.id === defaultModelId) return 1;
		if (left.created && right.created && left.created !== right.created) return right.created - left.created;
		return left.id.localeCompare(right.id);
	});
};

const fetchGatewayModels = async (): Promise<GatewayModelRecord[]> => {
	if (!env.AI_GATEWAY_API_KEY) return [];
	const response = await fetch("https://ai-gateway.vercel.sh/v1/models", {
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${env.AI_GATEWAY_API_KEY}`
		},
		signal: AbortSignal.timeout(GATEWAY_MODELS_TIMEOUT_MS)
	});
	if (!response.ok) throw new Error(`Vercel AI Gateway models API error: ${response.status}`);
	const payload = (await response.json()) as GatewayModelListResponse;
	return Array.isArray(payload.data) ? payload.data : [];
};

const getFallbackModelCatalog = (): AIModelDefinition[] => [
	...getModelsByProvider(gatewayProvider),
	...(getModelById(defaultModelId)
		? []
		: [{ id: defaultModelId, name: "GPT-5 Mini", provider: gatewayProvider, source: "fallback" as const }])
];

export const getAvailableChatModels = async (): Promise<AIModelDefinition[]> => {
	const now = Date.now();
	if (cachedModelCatalog && cachedModelCatalog.expiresAt > now) return cachedModelCatalog.data;

	try {
		const models = filterAvailableChatModels(await fetchGatewayModels());
		const resolvedModels = models.length > 0 ? models : getFallbackModelCatalog();
		cachedModelCatalog = { data: resolvedModels, expiresAt: now + MODEL_CACHE_TTL_MS };
		return resolvedModels;
	} catch {
		if (cachedModelCatalog?.data.length) return cachedModelCatalog.data;
		const fallbackCatalog = getFallbackModelCatalog();
		cachedModelCatalog = { data: fallbackCatalog, expiresAt: now + MODEL_CACHE_TTL_MS };
		return fallbackCatalog;
	}
};
