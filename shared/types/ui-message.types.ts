import { type InferUITools, type ToolSet, tool, type UIMessage } from "ai";
import { z } from "zod";

// Tool definitions
export const tools = {
	deepSearch: tool({
		description: "Perform deep web search with advanced filtering and analysis",
		execute: async () => ({ results: [] }),
		inputSchema: z.object({
			maxResults: z.number().optional().describe("Maximum number of results"),
			query: z.string().describe("Search query"),
			timeRange: z.string().optional().describe("Time range: day, week, month, year, all"),
		}),
	}),
	serper: tool({
		description: "Search the web using Serper API for real-time results",
		execute: async () => ({ organic: [], relatedSearches: [] }),
		inputSchema: z.object({
			q: z.string().describe("Search query"),
		}),
	}),
} satisfies ToolSet;

// Metadata schema
const metadataSchema = z.object({
	createdAt: z.string().datetime().optional(),
	totalTokens: z.number().optional(),
});

export type MyMetadata = z.infer<typeof metadataSchema>;
export type MyTools = InferUITools<typeof tools>;

export type MyUIMessage = UIMessage<MyMetadata, never, MyTools>;
