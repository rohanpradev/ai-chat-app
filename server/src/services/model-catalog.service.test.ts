import { describe, expect, it } from "bun:test";
import { filterAvailableChatModels, parseOpenAIModelOverrides } from "@/services/model-catalog.service";

describe("filterAvailableChatModels", () => {
	it("keeps stable chat-capable models and removes specialized or snapshot-only ids", () => {
		const models = filterAvailableChatModels([
			{ created: 6, id: "gpt-5-mini", object: "model", owned_by: "openai" },
			{ created: 5, id: "gpt-unapproved", object: "model", owned_by: "openai" },
			{ created: 4, id: "gpt-unapproved-mini", object: "model", owned_by: "openai" },
			{
				created: 3,
				id: "gpt-realtime-1.5",
				object: "model",
				owned_by: "openai"
			},
			{
				created: 2,
				id: "gpt-unapproved-transcribe",
				object: "model",
				owned_by: "openai"
			},
			{
				created: 1,
				id: "gpt-5-mini-2025-08-07",
				object: "model",
				owned_by: "openai"
			}
		]);

		expect(models.map((model) => model.id)).toEqual(["gpt-5-mini"]);
		expect(models[0]?.name).toBe("GPT-5 Mini");
	});
});

describe("parseOpenAIModelOverrides", () => {
	it("normalizes comma-separated model ids into deduplicated OpenAI catalog entries", () => {
		const models = parseOpenAIModelOverrides("gpt-5.5, gpt-5.5-mini, gpt-5.5");

		expect(models).toEqual([
			{
				id: "gpt-5.5",
				name: "GPT 5.5",
				provider: "openai",
				source: "override"
			},
			{
				id: "gpt-5.5-mini",
				name: "GPT 5.5 Mini",
				provider: "openai",
				source: "override"
			}
		]);
	});
});
