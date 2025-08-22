import { azure } from "@ai-sdk/azure";
import { openai } from "@ai-sdk/openai";
import type { LanguageModel, ModelMessage } from "ai";
import { convertToModelMessages, type UIMessage } from "ai";

type ModelType = LanguageModel | ((...args: any[]) => LanguageModel);
export const MODELS = {
	azureOpenAI: (modelName) => azure(modelName),
	openAI: (model = "gpt-4o-mini") => openai(model)
} satisfies Record<string, ModelType | ((...args: any[]) => ModelType)>;

export const transformPrompt = (message: UIMessage[]): ModelMessage[] =>
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
