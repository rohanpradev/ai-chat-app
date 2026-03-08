import { openai } from "@ai-sdk/openai";
import { type AIModelDefinition, type AIProvider, getModelById, getModelsByProvider } from "@chat-app/shared";
import type { LanguageModel, ModelMessage } from "ai";
import { convertToModelMessages, type UIMessage } from "ai";
import env from "@/utils/env";

const configuredProviders = (): AIProvider[] => (env.OPENAI_API_KEY ? ["openai"] : []);

const resolveConfiguredModel = (): AIModelDefinition => {
	const [fallbackModel] = getModelsByProvider("openai");

	if (!fallbackModel) {
		throw new Error('No models configured for provider "openai"');
	}

	return fallbackModel;
};

export const resolveModelSelection = (requestedModelId?: string): AIModelDefinition => {
	const availableProviders = configuredProviders();
	const requestedModel = getModelById(requestedModelId);

	if (requestedModel && availableProviders.some((provider) => provider === requestedModel.provider)) {
		return requestedModel;
	}

	if (availableProviders.length === 0) {
		throw new Error("OPENAI_API_KEY is required");
	}

	return resolveConfiguredModel();
};

export const resolveModel = (requestedModelId?: string): LanguageModel => {
	const resolvedModel = resolveModelSelection(requestedModelId);
	return openai(resolvedModel.id);
};

export const transformPrompt = async (message: UIMessage[]): Promise<ModelMessage[]> =>
	convertToModelMessages([
		{
			parts: [
				{
					text: "You are a helpful assistant that helps people find information. Be concise.",
					type: "text"
				}
			],
			role: "system"
		},
		...message
	]);
