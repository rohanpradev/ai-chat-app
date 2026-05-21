import { type AIModelDefinition, defaultModelId, getModelById, getModelsByProvider } from "@chat-app/shared";
import env from "@/utils/env";

interface OpenAIModelRecord {
	created: number;
	id: string;
	object: "model";
	owned_by: string;
}

interface OpenAIModelListResponse {
	data: OpenAIModelRecord[];
	object: "list";
}

const MODEL_CACHE_TTL_MS = 5 * 60 * 1000;
const OPENAI_MODELS_TIMEOUT_MS = 5000;

let cachedModelCatalog:
	| {
			data: AIModelDefinition[];
			expiresAt: number;
	  }
	| undefined;

const mergeUniqueModels = (models: readonly AIModelDefinition[]): AIModelDefinition[] => {
	const modelMap = new Map<string, AIModelDefinition>();

	for (const model of models) {
		if (!modelMap.has(model.id)) {
			modelMap.set(model.id, model);
		}
	}

	return [...modelMap.values()];
};

const fallbackModels = mergeUniqueModels(getModelsByProvider("openai"));
const fallbackOrderLookup = new Map(fallbackModels.map((model, index) => [model.id, index]));
const fallbackModelLookup = new Map(fallbackModels.map((model) => [model.id, model]));

export const filterAvailableChatModels = (models: readonly OpenAIModelRecord[]): AIModelDefinition[] =>
	mergeUniqueModels([
		...models
			.filter((model) => fallbackModelLookup.has(model.id))
			.map((model) => {
				const fallbackModel = fallbackModelLookup.get(model.id);
				return {
					created: model.created,
					id: model.id,
					name: fallbackModel?.name ?? model.id,
					ownedBy: model.owned_by,
					provider: "openai" as const,
					source: "api" as const
				};
			}),
		...fallbackModels
	]).sort((left, right) => {
		const leftFallbackOrder = fallbackOrderLookup.get(left.id);
		const rightFallbackOrder = fallbackOrderLookup.get(right.id);

		if (leftFallbackOrder !== undefined && rightFallbackOrder !== undefined && leftFallbackOrder !== rightFallbackOrder) {
			return leftFallbackOrder - rightFallbackOrder;
		}

		if (left.id === defaultModelId) {
			return -1;
		}

		if (right.id === defaultModelId) {
			return 1;
		}

		if (left.created && right.created && left.created !== right.created) {
			return right.created - left.created;
		}

		return left.id.localeCompare(right.id);
	});

const fetchOpenAIModels = async (): Promise<OpenAIModelRecord[]> => {
	if (!env.OPENAI_API_KEY) {
		return [];
	}

	const response = await fetch("https://api.openai.com/v1/models", {
		headers: {
			Accept: "application/json",
			Authorization: `Bearer ${env.OPENAI_API_KEY}`
		},
		signal: AbortSignal.timeout(OPENAI_MODELS_TIMEOUT_MS)
	});

	if (!response.ok) {
		throw new Error(`OpenAI models API error: ${response.status}`);
	}

	const payload = (await response.json()) as OpenAIModelListResponse;
	return Array.isArray(payload.data) ? payload.data : [];
};

const getFallbackModelCatalog = (): AIModelDefinition[] =>
	fallbackModels.length > 0
		? fallbackModels
		: [
				{
					id: defaultModelId,
					name: getModelById(defaultModelId)?.name ?? "GPT-5 Mini",
					provider: "openai",
					source: "fallback"
				}
			];

export const getAvailableChatModels = async (): Promise<AIModelDefinition[]> => {
	const now = Date.now();

	if (cachedModelCatalog && cachedModelCatalog.expiresAt > now) {
		return cachedModelCatalog.data;
	}

	try {
		const models = filterAvailableChatModels(await fetchOpenAIModels());
		const resolvedModels = models.length > 0 ? models : getFallbackModelCatalog();

		cachedModelCatalog = {
			data: resolvedModels,
			expiresAt: now + MODEL_CACHE_TTL_MS
		};

		return resolvedModels;
	} catch {
		if (cachedModelCatalog?.data.length) {
			return cachedModelCatalog.data;
		}

		const fallbackCatalog = getFallbackModelCatalog();

		cachedModelCatalog = {
			data: fallbackCatalog,
			expiresAt: now + MODEL_CACHE_TTL_MS
		};

		return fallbackCatalog;
	}
};
