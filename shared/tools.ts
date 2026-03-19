import { type ToolSet, tool } from "ai";
import { z } from "zod";

const deepSearchInputSchema = z.object({
	maxResults: z.number().optional().describe("Maximum number of results"),
	query: z.string().describe("Search query"),
	timeRange: z.string().optional().describe("Time range: day, week, month, year, all"),
});

type DeepSearchToolInput = z.infer<typeof deepSearchInputSchema>;

const serperInputSchema = z.object({
	q: z
		.string()
		.min(1)
		.describe(
			"Focused web search query. Rewrite the user's request into concise search terms with entities, dates, and site filters when helpful.",
		),
});

const serperAnswerBoxSchema = z
	.object({
		answer: z.string().optional(),
		link: z.url().optional(),
		snippet: z.string().optional(),
		title: z.string().optional(),
	})
	.partial();

const serperKnowledgeGraphSchema = z
	.object({
		attributes: z.record(z.string(), z.string()).optional(),
		description: z.string().optional(),
		descriptionLink: z.url().optional(),
		title: z.string().optional(),
		type: z.string().optional(),
		website: z.url().optional(),
	})
	.partial();

const serperOrganicResultSchema = z.object({
	date: z.string().optional(),
	link: z.url(),
	position: z.number().int().nonnegative(),
	snippet: z.string(),
	source: z.string().optional(),
	title: z.string(),
});

const serperPeopleAlsoAskSchema = z.object({
	link: z.url().optional(),
	question: z.string(),
	snippet: z.string().optional(),
	title: z.string().optional(),
});

const serperRelatedSearchSchema = z.object({
	query: z.string(),
});

const serperSearchParametersSchema = z.object({
	q: z.string(),
});

export const serperOutputSchema = z.object({
	answerBox: serperAnswerBoxSchema.optional(),
	knowledgeGraph: serperKnowledgeGraphSchema.optional(),
	organic: z.array(serperOrganicResultSchema),
	peopleAlsoAsk: z.array(serperPeopleAlsoAskSchema),
	relatedSearches: z.array(serperRelatedSearchSchema),
	searchParameters: serperSearchParametersSchema,
	totalResults: z.number().nonnegative(),
});

export type SerperToolInput = z.infer<typeof serperInputSchema>;
export type SerperToolOutput = z.infer<typeof serperOutputSchema>;

const serperInputExamples: Array<{ input: SerperToolInput }> = [
	{ input: { q: "latest OpenAI API Responses API docs" } },
	{ input: { q: "site:kubernetes.io pod disruption budget v1 docs" } },
];

export const uiMessageToolDefinitions = {
	deepSearch: {
		description: "Perform deep web search with advanced filtering and analysis",
		inputSchema: deepSearchInputSchema,
		strict: true,
	},
	serper: {
		description:
			"Search the live web for up-to-date factual information. Use this for recent news, current product or company details, changing regulations, or anything that may have changed after training. Returns summarized search results and links, not full page contents.",
		inputExamples: serperInputExamples,
		inputSchema: serperInputSchema,
		outputSchema: serperOutputSchema,
		strict: true,
		title: "Web Search",
	},
} as const;

// Keep legacy tool shapes available for UI-message validation and old persisted
// conversations, but only expose production-ready tools to new requests.
export const uiMessageTools = {
	deepSearch: tool<DeepSearchToolInput>(uiMessageToolDefinitions.deepSearch),
	serper: tool<SerperToolInput, SerperToolOutput>(uiMessageToolDefinitions.serper),
} satisfies ToolSet;

export const enabledRequestToolIds = ["serper"] as const;
export type EnabledRequestToolId = (typeof enabledRequestToolIds)[number];

export const webSearchToolId: EnabledRequestToolId = "serper";
