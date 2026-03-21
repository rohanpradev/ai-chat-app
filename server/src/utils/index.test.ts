import { describe, expect, it } from "bun:test";
import type { UIMessage } from "ai";
import { transformPrompt } from "@/utils/index";

describe("transformPrompt", () => {
	it("prunes reasoning for plain chat history", async () => {
		const messages: UIMessage[] = [
			{
				id: "user-1",
				parts: [{ text: "Tell me about Kubernetes", type: "text" }],
				role: "user"
			},
			{
				id: "assistant-1",
				parts: [
					{ state: "done", text: "I should answer directly.", type: "reasoning" },
					{ state: "done", text: "Kubernetes is a container orchestration platform.", type: "text" }
				],
				role: "assistant"
			},
			{
				id: "user-2",
				parts: [{ text: "What about deployments?", type: "text" }],
				role: "user"
			}
		];

		const transformed = await transformPrompt(messages);
		const earlierAssistantMessage = transformed.find((message) => message.role === "assistant");

		expect(earlierAssistantMessage).toBeDefined();
		expect(Array.isArray(earlierAssistantMessage?.content)).toBe(true);

		if (!earlierAssistantMessage || !Array.isArray(earlierAssistantMessage.content)) {
			throw new Error("Expected assistant model message content");
		}

		expect(earlierAssistantMessage.content.some((part) => part.type === "reasoning")).toBe(false);
	});

	it("keeps reasoning when an assistant tool call would otherwise become orphaned", async () => {
		const messages: UIMessage[] = [
			{
				id: "user-1",
				parts: [{ text: "Find Debjit Mookherjee at Ericsson", type: "text" }],
				role: "user"
			},
			{
				id: "assistant-1",
				parts: [
					{ state: "done", text: "I need live search results first.", type: "reasoning" },
					{
						input: { q: "Debjit Mookherjee Ericsson" },
						output: {
							organic: [
								{
									link: "https://example.com/debjit",
									position: 1,
									snippet: "Profile snippet",
									title: "Debjit Mookherjee"
								}
							],
							peopleAlsoAsk: [],
							relatedSearches: [],
							searchParameters: { q: "Debjit Mookherjee Ericsson" },
							totalResults: 1
						},
						state: "output-available",
						toolCallId: "tool-1",
						type: "tool-serper"
					}
				],
				role: "assistant"
			}
		];

		const transformed = await transformPrompt(messages);
		const assistantToolCallMessage = transformed.find(
			(message) =>
				message.role === "assistant" &&
				Array.isArray(message.content) &&
				message.content.some((part) => part.type === "tool-call")
		);

		expect(assistantToolCallMessage).toBeDefined();
		expect(Array.isArray(assistantToolCallMessage?.content)).toBe(true);

		if (!assistantToolCallMessage || !Array.isArray(assistantToolCallMessage.content)) {
			throw new Error("Expected assistant tool-call model message content");
		}

		expect(assistantToolCallMessage.content.some((part) => part.type === "reasoning")).toBe(true);
	});
});
