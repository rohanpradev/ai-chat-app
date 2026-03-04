import { azure } from "@ai-sdk/azure";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel, ModelMessage } from "ai";
import { convertToModelMessages, type UIMessage } from "ai";
import env from "@/utils/env";

type ModelFactory = (model?: string) => LanguageModel;
type ModelType = LanguageModel | ModelFactory;
export const MODELS = {
	azureOpenAI: (model = "gpt-5-mini") => azure(model),
	openAI: (model = "gpt-4o-mini") => openai(model)
} satisfies Record<string, ModelType>;

export const resolveModel = (model = "gpt-5-mini"): LanguageModel => {
	const hasAzure = Boolean(env.AZURE_API_KEY && env.AZURE_RESOURCE_NAME);
	if (hasAzure) {
		return MODELS.azureOpenAI(model);
	}

	return MODELS.openAI(model);
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
