import { describe, expect, it } from "bun:test";
import { filterAvailableChatModels } from "@/services/model-catalog.service";

describe("filterAvailableChatModels", () => {
	it("includes Gateway chat models and omits specialized models", () => {
		const models = filterAvailableChatModels([
			{ created: 6, id: "openai/gpt-5-mini", owned_by: "openai", type: "language" },
			{ created: 5, id: "anthropic/claude-sonnet-5", owned_by: "anthropic", type: "language" },
			{ created: 4, id: "openai/text-embedding-3-small", type: "embedding" },
			{ created: 3, id: "openai/gpt-audio", type: "language" }
		]);

		expect(models.map((model) => model.id)).toEqual(["openai/gpt-5-mini", "anthropic/claude-sonnet-5"]);
		expect(models[0]?.name).toBe("OpenAI · GPT-5 Mini");
		expect(models[1]?.provider).toBe("vercel-ai-gateway");
	});
});
