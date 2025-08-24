import { tool } from "ai";
import { z } from "zod";
import env from "@/utils/env";

export const tools = {
	deepSearch: tool({
		description: "Perform deep web search with advanced filtering and analysis",
		execute: async ({ query, maxResults, timeRange }) => {
			return {
				maxResults: maxResults || 10,
				message: "Deep search functionality not yet implemented",
				query,
				results: [],
				timeRange: timeRange || "all",
				totalFound: 0
			};
		},
		inputSchema: z.object({
			maxResults: z.number().optional().describe("Maximum number of results"),
			query: z.string().describe("Search query"),
			timeRange: z.string().optional().describe("Time range: day, week, month, year, all")
		})
	}),

	serper: tool({
		description: "Search the web using Serper API for real-time results",
		execute: async ({ q }) => {
			try {
				const apiKey = env.SERPER_API_KEY;
				const response = await fetch("https://google.serper.dev/search", {
					body: JSON.stringify({ q }),
					headers: {
						"Content-Type": "application/json",
						"X-API-KEY": apiKey
					},
					method: "POST"
				});
				if (!response.ok) {
					const _errorText = await response.text();
					throw new Error(`Serper API error: ${response.status}`);
				}

				const data = await response.json();
				return {
					answerBox: data.answerBox,
					knowledgeGraph: data.knowledgeGraph,
					organic: data.organic?.slice(0, 10) || [],
					peopleAlsoAsk: data.peopleAlsoAsk,
					query: q,
					relatedSearches: data.relatedSearches,
					searchInformation: data.searchInformation,
					totalResults: data.searchInformation?.totalResults || 0
				};
			} catch (error) {
				return {
					error: error instanceof Error ? error.message : "Unknown error",
					query: q
				};
			}
		},
		inputSchema: z.object({
			q: z.string().describe("Search query")
		})
	})
};

export function getAvailableTools(toolNames?: string[]) {
	return (
		toolNames?.reduce(
			(selectedTools, toolName) => {
				if (toolName in tools) {
					selectedTools[toolName] = tools[toolName as keyof typeof tools];
				}
				return selectedTools;
			},
			{} as Record<string, (typeof tools)[keyof typeof tools]>
		) ?? {}
	);
}
