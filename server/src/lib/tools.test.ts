import { afterEach, describe, expect, it, mock } from "bun:test";
import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { chatToolApproval, tools } from "@/lib/tools";

const originalFetch = globalThis.fetch;
const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
	typeof value === "object" && value !== null && Symbol.asyncIterator in value;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("serper tool", () => {
	for (const approved of [false, true]) {
		it(`requires a signed approval before web search and ${approved ? "executes once after approval" : "does not execute after denial"}`, async () => {
			const fetchSearch = mock(async () => Response.json({ organic: [] }));
			globalThis.fetch = Object.assign(fetchSearch, { preconnect: originalFetch.preconnect });
			const input = { q: "current package documentation" };
			const usage = {
				inputTokens: { cacheRead: undefined, cacheWrite: undefined, noCache: 10, total: 10 },
				outputTokens: { reasoning: undefined, text: 5, total: 5 }
			};
			const secret = "serper-approval-test-secret-at-least-32-characters";
			const pending = await generateText({
				experimental_toolApprovalSecret: secret,
				model: new MockLanguageModelV3({
					doGenerate: async () => ({
						content: [{ input: JSON.stringify(input), toolCallId: "search-1", toolName: "serper", type: "tool-call" }],
						finishReason: { raw: "tool_calls", unified: "tool-calls" },
						usage,
						warnings: []
					})
				}),
				prompt: "Find current documentation",
				toolApproval: chatToolApproval,
				tools: { serper: tools.serper }
			});
			expect(fetchSearch).not.toHaveBeenCalled();
			const approval = pending.content.find((part) => part.type === "tool-approval-request");
			if (approval?.type !== "tool-approval-request") throw new Error("Expected a signed search approval request");
			expect(approval.signature).toBeTruthy();
			await generateText({
				experimental_toolApprovalSecret: secret,
				messages: [
					...pending.responseMessages,
					{ content: [{ approvalId: approval.approvalId, approved, type: "tool-approval-response" }], role: "tool" }
				],
				model: new MockLanguageModelV3({
					doGenerate: async () => ({
						content: [{ text: "Done", type: "text" }],
						finishReason: { raw: "stop", unified: "stop" },
						usage,
						warnings: []
					})
				}),
				toolApproval: chatToolApproval,
				tools: { serper: tools.serper }
			});
			expect(fetchSearch).toHaveBeenCalledTimes(approved ? 1 : 0);
		});
	}

	it("normalizes Serper responses for the UI and model", async () => {
		globalThis.fetch = mock(async () => {
			return new Response(
				JSON.stringify({
					answerBox: {
						answer: "OpenAI released a new API update.",
						title: "OpenAI API update"
					},
					knowledgeGraph: {
						description: "OpenAI develops AI systems.",
						title: "OpenAI",
						type: "AI company"
					},
					organic: [
						{
							link: "https://platform.openai.com/docs",
							position: 1,
							snippet: "Official API docs",
							title: "OpenAI Docs"
						},
						{
							link: "javascript:alert(document.domain)",
							position: 2,
							snippet: "This result should be filtered out",
							title: "Unsafe result"
						},
						{
							link: "notaurl",
							position: 3,
							snippet: "This result should be filtered out",
							title: "Broken result"
						}
					],
					peopleAlsoAsk: [
						{
							question: "What changed in the API?",
							snippet: "The update added new tooling."
						}
					],
					relatedSearches: [{ query: "OpenAI API docs" }],
					searchInformation: { totalResults: 12345 }
				}),
				{
					headers: { "Content-Type": "application/json" },
					status: 200
				}
			);
		}) as unknown as typeof fetch;

		const outputResult = await tools.serper.execute?.(
			{ q: "latest OpenAI API update" },
			{
				abortSignal: undefined,
				context: {},
				messages: [],
				toolCallId: "tool-1"
			}
		);

		expect(outputResult).toBeDefined();
		if (!outputResult || isAsyncIterable(outputResult)) {
			throw new Error("Expected non-streaming Serper tool output");
		}

		const output = outputResult;
		expect(output.searchParameters.q).toBe("latest OpenAI API update");
		expect(output.totalResults).toBe(12345);
		expect(output.organic).toHaveLength(1);
		expect(output.organic[0]?.title).toBe("OpenAI Docs");
		expect(output.answerBox?.answer).toBe("OpenAI released a new API update.");

		const modelOutput = await tools.serper.toModelOutput?.({
			input: { q: "latest OpenAI API update" },
			output,
			toolCallId: "tool-1"
		});

		expect(modelOutput).toBeDefined();
		expect(modelOutput?.type).toBe("text");
		if (modelOutput?.type !== "text") {
			throw new Error("Expected text model output");
		}

		expect(modelOutput.value).toContain("Web search query: latest OpenAI API update");
		expect(modelOutput.value).toContain("Top search results:");
	});

	it("throws on upstream Serper errors", async () => {
		globalThis.fetch = mock(async () => new Response("upstream error", { status: 503 })) as unknown as typeof fetch;

		await expect(
			tools.serper.execute?.(
				{ q: "status page" },
				{
					abortSignal: undefined,
					context: {},
					messages: [],
					toolCallId: "tool-2"
				}
			)
		).rejects.toThrow("Serper API error: 503");
	});
});
