import { generateText, smoothStream, stepCountIs, streamText, type UIMessage } from "ai";
import { getAvailableTools } from "@/lib/tools";
import type { AppRouteHandler } from "@/lib/types";
import type { AIRoute, AIStreamRoute } from "@/routes/ai/ai.route";
import { MODELS, transformPrompt } from "@/utils/index";

export const ai: AppRouteHandler<AIRoute> = async (c) => {
	const { messages, model = "gpt-5-mini", tools: toolNames } = c.req.valid("json");

	const selectedTools = getAvailableTools(toolNames);
	const { text } = await generateText({
		messages: transformPrompt(messages as UIMessage[]),
		model: MODELS.azureOpenAI(model),
		stopWhen: stepCountIs(2),
		tools: selectedTools
	});

	const resultMessage: UIMessage = {
		id: Bun.randomUUIDv7(),
		metadata: { createdAt: new Date() },
		parts: [{ text, type: "text" }],
		role: "assistant"
	};

	return c.json({ messages: [...messages, resultMessage] });
};

export const aiStream: AppRouteHandler<AIStreamRoute> = async (c) => {
	const { messages, model = "gpt-5-mini", tools: toolNames = [] } = c.req.valid("json");

	const selectedTools = getAvailableTools(toolNames);
	const result = streamText({
		experimental_transform: smoothStream(),
		messages: transformPrompt(messages as UIMessage[]),
		model: MODELS.azureOpenAI(model),
		stopWhen: stepCountIs(2),
		toolChoice: toolNames.length > 0 ? "required" : "auto",
		tools: selectedTools
	});

	return result.toUIMessageStreamResponse({
		messageMetadata: ({ part }) => {
			if (part.type === "finish") {
				return {
					createdAt: Date.now(),
					totalTokens: part.totalUsage.totalTokens
				};
			}
		}
	});
};
