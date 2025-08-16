import { azure } from "@ai-sdk/azure";
import type { LanguageModel, ModelMessage } from "ai";
import { convertToModelMessages, type UIMessage } from "ai";

type ModelType = LanguageModel | ((...args: any[]) => LanguageModel);
export const MODELS = {
	azureOpenAI: (modelName = "gpt-4") => azure(modelName)
} satisfies Record<string, ModelType | ((...args: any[]) => ModelType)>;

export const COMMON_SYSTEM_MESSAGE =
	"You are a helpful AI agent. When you have access to tools, you MUST use them when appropriate. For calculations, use the calculator tool. For web searches, use the serper tool. Always use the available tools rather than relying on your training data alone.";

export const transformPrompt = (message: UIMessage[], systemPropmt: string = COMMON_SYSTEM_MESSAGE): ModelMessage[] => {
	return convertToModelMessages([
		{
			parts: [{ text: systemPropmt, type: "text" }],
			role: "system"
		},
		...message
	]);
};
