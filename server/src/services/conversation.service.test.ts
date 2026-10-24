import { describe, expect, it } from "bun:test";
import type { MyUIMessage } from "@chat-app/shared";
import { mergeConversationMessages } from "@/services/conversation.service";

const prompt: MyUIMessage = { id: "prompt", parts: [{ text: "Question", type: "text" }], role: "user" };
const pendingApproval: MyUIMessage = {
	id: "assistant",
	metadata: { model: "server-model" },
	parts: [
		{ text: "Server explanation", type: "text" },
		{
			approval: { descriptor: { source: "server" }, id: "approval", signature: "signature" },
			input: { q: "Original query" },
			state: "approval-requested",
			toolCallId: "call",
			type: "tool-serper"
		}
	],
	role: "assistant"
};
const respond = (approved: boolean): MyUIMessage => ({
	id: "assistant",
	metadata: { model: "client-model" },
	parts: [
		{ text: "Client replacement", type: "text" },
		{
			approval: {
				approved,
				descriptor: { source: "client" },
				id: "approval",
				reason: "User decision",
				signature: "signature"
			},
			input: { q: "Original query" },
			state: "approval-responded",
			toolCallId: "call",
			type: "tool-serper"
		}
	],
	role: "assistant"
});

describe("server-owned conversation history", () => {
	it("preserves stored revisions when a stale full history contains the same IDs", () => {
		const stored: MyUIMessage = {
			id: "answer",
			metadata: { model: "current-model" },
			parts: [{ text: "Current answer", type: "text" }],
			role: "assistant"
		};
		const stale: MyUIMessage = {
			...stored,
			metadata: { model: "old-model" },
			parts: [{ text: "Old answer", type: "text" }]
		};
		const newPrompt: MyUIMessage = { id: "new-prompt", parts: [{ text: "Next question", type: "text" }], role: "user" };
		expect(mergeConversationMessages([prompt, stored], [prompt, stale, newPrompt])).toEqual([prompt, stored, newPrompt]);
	});

	it("preserves stored identity and role when an incoming message reuses its ID", () => {
		expect(
			mergeConversationMessages([prompt], [{ ...prompt, parts: [{ text: "Altered", type: "text" }], role: "assistant" }])
		).toEqual([prompt]);
	});

	it.each([true, false])(
		"accepts a current approval decision (%s) without replacing server-owned content",
		(approved) => {
			const response = respond(approved);
			const merged = mergeConversationMessages([prompt, pendingApproval], [response]);
			expect(merged).toEqual([
				prompt,
				{
					...pendingApproval,
					parts: [
						{ text: "Server explanation", type: "text" },
						{
							approval: {
								approved,
								descriptor: { source: "server" },
								id: "approval",
								reason: "User decision",
								signature: "signature"
							},
							input: { q: "Original query" },
							state: "approval-responded",
							toolCallId: "call",
							type: "tool-serper"
						}
					]
				}
			]);
		}
	);

	it("rejects tampered call input and signature before accepting a decision", () => {
		for (const mutation of [
			{ approval: { approved: true, id: "approval", signature: "tampered" }, input: { q: "Original query" } },
			{ approval: { approved: true, id: "approval", signature: "signature" }, input: { q: "Different query" } }
		]) {
			const response: MyUIMessage = {
				id: "assistant",
				parts: [
					{
						...mutation,
						state: "approval-responded",
						toolCallId: "call",
						type: "tool-serper"
					}
				],
				role: "assistant"
			};
			expect(() => mergeConversationMessages([prompt, pendingApproval], [response])).toThrow(
				expect.objectContaining({ status: 400 })
			);
		}
	});

	it("rejects a repeated approval response after it has been handled", () => {
		const handled = mergeConversationMessages([prompt, pendingApproval], [respond(true)]);
		expect(() => mergeConversationMessages(handled, [respond(true)])).toThrow(expect.objectContaining({ status: 409 }));
	});

	it("rejects an approval response for an earlier assistant after a newer turn", () => {
		const newer: MyUIMessage = { ...prompt, id: "newer" };
		expect(() => mergeConversationMessages([prompt, pendingApproval, newer], [respond(true)])).toThrow(
			expect.objectContaining({ status: 409 })
		);
	});

	it("does not restore an old pending approval over a completed tool result", () => {
		const completed: MyUIMessage = {
			id: "assistant",
			parts: [
				{
					input: { q: "Original query" },
					output: {
						organic: [],
						peopleAlsoAsk: [],
						relatedSearches: [],
						searchParameters: { q: "Original query" },
						totalResults: 0
					},
					state: "output-available",
					toolCallId: "call",
					type: "tool-serper"
				}
			],
			role: "assistant"
		};
		expect(mergeConversationMessages([prompt, completed], [prompt, pendingApproval])).toEqual([prompt, completed]);
		expect(() => mergeConversationMessages([prompt, completed], [respond(true)])).toThrow(
			expect.objectContaining({ status: 409 })
		);
	});
});
