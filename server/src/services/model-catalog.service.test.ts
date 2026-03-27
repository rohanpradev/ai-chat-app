import { describe, expect, it } from "bun:test";
import { filterAvailableChatModels, parseConfiguredModelOverrides } from "@/services/model-catalog.service";

describe("filterAvailableChatModels", () => {
	it("keeps stable chat-capable models and removes specialized or snapshot-only ids", () => {
		const models = filterAvailableChatModels([
			{ created: 5, id: "gpt-5.4", object: "model", owned_by: "openai" },
			{ created: 4, id: "gpt-5.4-mini", object: "model", owned_by: "openai" },
			{
				created: 3,
				id: "gpt-realtime-1.5",
				object: "model",
				owned_by: "openai"
			},
			{
				created: 2,
				id: "gpt-4o-transcribe",
				object: "model",
				owned_by: "openai"
			},
			{
				created: 1,
				id: "gpt-5.4-mini-2025-08-07",
				object: "model",
				owned_by: "openai"
			}
		]);

		expect(models.map((model) => model.id)).toEqual(["gpt-5.4", "gpt-5.4-mini"]);
		expect(models[0]?.name).toBe("GPT-5.4");
		expect(models[1]?.name).toBe("GPT-5.4 Mini");
	});
});

describe("parseConfiguredModelOverrides", () => {
	it("parses unique operator-provided model overrides", () => {
		const models = parseConfiguredModelOverrides(" gpt-5.1-mini, gpt-5.1-mini , codex-mini-latest ");

		expect(models).toEqual([
			{
				id: "gpt-5.1-mini",
				name: "GPT-5.1 Mini",
				provider: "openai",
				source: "fallback"
			},
			{
				id: "codex-mini-latest",
				name: "Codex Mini latest",
				provider: "openai",
				source: "fallback"
			}
		]);
	});
});
