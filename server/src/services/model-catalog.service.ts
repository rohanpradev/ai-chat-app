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
const snapshotSuffixPattern = /-\d{4}-\d{2}-\d{2}$/;
const supportedPrefixes = [/^gpt-/, /^o\d/, /^codex/];
const unsupportedFragments = [
	"audio",
	"computer-use",
	"deep-research",
	"embedding",
	"image",
	"moderation",
	"omni-moderation",
	"preview",
	"realtime",
	"search-preview",
	"sora",
	"transcribe",
	"tts",
	"whisper"
];

let cachedModelCatalog:
	| {
			data: AIModelDefinition[];
			expiresAt: number;
	  }
	| undefined;

const knownModelSegmentLabels: Record<string, string> = {
	codex: "Codex",
	mini: "Mini",
	nano: "Nano",
	oss: "OSS",
	pro: "Pro"
};

const formatModelSegment = (segment: string): string => {
	const normalizedSegment = segment.toLowerCase();
	const knownLabel = knownModelSegmentLabels[normalizedSegment];

	if (knownLabel) {
		return knownLabel;
	}

	if (/^\d+b$/i.test(segment)) {
		return segment.toUpperCase();
	}

	return segment;
};

const buildDefaultModelDisplayName = (modelId: string): string => {
	const [family, ...qualifiers] = modelId.split("-");

	if (family === "gpt" && qualifiers.length > 0) {
		const [variant, ...rest] = qualifiers;

		return [`GPT-${formatModelSegment(variant)}`, ...rest.map(formatModelSegment)].filter(Boolean).join(" ");
	}

	return [formatModelSegment(family), ...qualifiers.map(formatModelSegment)].filter(Boolean).join(" ");
};

const mergeUniqueModels = (models: readonly AIModelDefinition[]): AIModelDefinition[] => {
	const modelMap = new Map<string, AIModelDefinition>();

	for (const model of models) {
		if (!modelMap.has(model.id)) {
			modelMap.set(model.id, model);
		}
	}

	return [...modelMap.values()];
};

export const parseConfiguredModelOverrides = (configuredModelIds: string | undefined): AIModelDefinition[] => {
	if (!configuredModelIds) {
		return [];
	}

	return mergeUniqueModels(
		configuredModelIds
			.split(",")
			.map((modelId) => modelId.trim())
			.filter(Boolean)
			.map((modelId) => ({
				id: modelId,
				name: buildDefaultModelDisplayName(modelId),
				provider: "openai" as const,
				source: "fallback" as const
			}))
	);
};

const configuredModelOverrides = parseConfiguredModelOverrides(env.OPENAI_MODEL_OVERRIDES);
const fallbackModels = mergeUniqueModels([...getModelsByProvider("openai"), ...configuredModelOverrides]);
const fallbackNameLookup = new Map(fallbackModels.map((model) => [model.id, model.name]));
const fallbackOrderLookup = new Map(fallbackModels.map((model, index) => [model.id, index]));

const buildModelDisplayName = (modelId: string): string => {
	const fallbackName = fallbackNameLookup.get(modelId);

	if (fallbackName) {
		return fallbackName;
	}

	return buildDefaultModelDisplayName(modelId);
};

const isSupportedChatModelId = (modelId: string) => {
	const normalizedId = modelId.toLowerCase();

	if (normalizedId.startsWith("chatgpt-") || normalizedId.startsWith("ft:")) {
		return false;
	}

	if (snapshotSuffixPattern.test(normalizedId)) {
		return false;
	}

	if (unsupportedFragments.some((fragment) => normalizedId.includes(fragment))) {
		return false;
	}

	return supportedPrefixes.some((pattern) => pattern.test(normalizedId));
};

export const filterAvailableChatModels = (models: readonly OpenAIModelRecord[]): AIModelDefinition[] =>
	mergeUniqueModels([
		...models
			.filter((model) => isSupportedChatModelId(model.id))
			.map((model) => ({
				created: model.created,
				id: model.id,
				name: buildModelDisplayName(model.id),
				ownedBy: model.owned_by,
				provider: "openai" as const,
				source: "api" as const
			})),
		...configuredModelOverrides
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
			Authorization: `Bearer ${env.OPENAI_API_KEY}`
		}
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
					name: getModelById(defaultModelId)?.name ?? "GPT-5.4",
					provider: "openai",
					source: "fallback"
				}
			];

export const clearAvailableModelCatalogCache = () => {
	cachedModelCatalog = undefined;
};

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
