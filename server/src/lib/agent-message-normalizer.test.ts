import { describe, expect, it } from "bun:test";
import type { MyUIMessage } from "@chat-app/shared";
import { normalizeMessagesForAgent } from "@/lib/agent-message-normalizer";

describe("normalizeMessagesForAgent", () => {
	it("removes in-flight tool parts but preserves sibling content", () => {
		const messages = [
			{
				id: "user-1",
				parts: [{ text: "Find the latest AI news", type: "text" }],
				role: "user"
			},
			{
				id: "assistant-1",
				parts: [
					{ text: "Checking the web.", type: "text" },
					{
						approval: { id: "approval-1" },
						input: { q: "latest AI news" },
						state: "approval-requested",
						toolCallId: "tool-1",
						type: "tool-serper"
					}
				],
				role: "assistant"
			}
		] as unknown as MyUIMessage[];

		const normalizedMessages = normalizeMessagesForAgent(messages);

		expect(normalizedMessages).toHaveLength(2);
		expect(normalizedMessages[1]?.parts).toEqual([{ text: "Checking the web.", type: "text" }]);
	});

	it("preserves completed tool output parts", () => {
		const messages = [
			{
				id: "assistant-1",
				parts: [
					{
						input: { q: "latest AI news" },
						output: {
							organic: [],
							peopleAlsoAsk: [],
							relatedSearches: [],
							searchParameters: { q: "latest AI news" },
							totalResults: 0
						},
						state: "output-available",
						toolCallId: "tool-1",
						type: "tool-serper"
					}
				],
				role: "assistant"
			}
		] as unknown as MyUIMessage[];

		const normalizedMessages = normalizeMessagesForAgent(messages);

		expect(normalizedMessages).toEqual(messages);
	});
});
