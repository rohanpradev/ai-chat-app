import { afterEach, describe, expect, it, mock } from "bun:test";
import { tools } from "@/lib/tools";

const originalFetch = globalThis.fetch;
const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> =>
	typeof value === "object" && value !== null && Symbol.asyncIterator in value;

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("serper tool", () => {
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
							link: "notaurl",
							position: 2,
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
				experimental_context: undefined,
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
		if (!modelOutput || modelOutput.type !== "text") {
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
					experimental_context: undefined,
					messages: [],
					toolCallId: "tool-2"
				}
			)
		).rejects.toThrow("Serper API error: 503");
	});
});
