import {
	type EnabledRequestToolId,
	type SerperToolInput,
	type SerperToolOutput,
	serperInputSchema,
	serperOutputSchema,
} from "@chat-app/shared";
import { tool, zodSchema } from "ai";
import env from "@/utils/env";

type SerperOrganicResult = SerperToolOutput["organic"][number];
type SerperPeopleAlsoAskResult = SerperToolOutput["peopleAlsoAsk"][number];
type SerperRelatedSearchResult = SerperToolOutput["relatedSearches"][number];

const isDefined = <T>(value: T | null): value is T => value !== null;

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const toOptionalNumber = (value: unknown): number | undefined => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const normalized = Number(value.replaceAll(",", ""));
		if (Number.isFinite(normalized)) {
			return normalized;
		}
	}

	return undefined;
};

const toOptionalString = (value: unknown): string | undefined => {
	if (typeof value !== "string") {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
};

const toOptionalUrl = (value: unknown): string | undefined => {
	const url = toOptionalString(value);
	if (!url) {
		return undefined;
	}

	try {
		new URL(url);
		return url;
	} catch {
		return undefined;
	}
};

const normalizeStringRecord = (value: unknown): Record<string, string> | undefined => {
	if (!isRecord(value)) {
		return undefined;
	}

	const record = Object.entries(value).reduce<Record<string, string>>((accumulator, [key, entryValue]) => {
		const normalizedValue = toOptionalString(entryValue);

		if (normalizedValue !== undefined) {
			accumulator[key] = normalizedValue;
		}

		return accumulator;
	}, {});

	return Object.keys(record).length > 0 ? record : undefined;
};

const normalizeSerperOutput = (query: string, payload: unknown): SerperToolOutput => {
	const data = isRecord(payload) ? payload : {};
	const answerBox = isRecord(data.answerBox)
		? {
				answer: toOptionalString(data.answerBox.answer),
				link: toOptionalUrl(data.answerBox.link),
				snippet: toOptionalString(data.answerBox.snippet),
				title: toOptionalString(data.answerBox.title)
			}
		: undefined;

	const knowledgeGraph = isRecord(data.knowledgeGraph)
		? {
				attributes: normalizeStringRecord(data.knowledgeGraph.attributes),
				description: toOptionalString(data.knowledgeGraph.description),
				descriptionLink: toOptionalUrl(data.knowledgeGraph.descriptionLink),
				title: toOptionalString(data.knowledgeGraph.title),
				type: toOptionalString(data.knowledgeGraph.type),
				website: toOptionalUrl(data.knowledgeGraph.website)
			}
		: undefined;

	const organic = Array.isArray(data.organic)
		? data.organic
				.map((entry, index): SerperOrganicResult | null => {
					if (!isRecord(entry)) {
						return null;
					}

					const link = toOptionalUrl(entry.link);
					const title = toOptionalString(entry.title);
					if (!link || !title) {
						return null;
					}

					return {
						date: toOptionalString(entry.date),
						link,
						position: toOptionalNumber(entry.position) ?? index + 1,
						snippet: toOptionalString(entry.snippet) ?? "",
						source: toOptionalString(entry.source),
						title
					};
				})
				.filter(isDefined)
				.slice(0, 8)
		: [];

	const peopleAlsoAsk = Array.isArray(data.peopleAlsoAsk)
		? data.peopleAlsoAsk
				.map((entry): SerperPeopleAlsoAskResult | null => {
					if (!isRecord(entry)) {
						return null;
					}

					const question = toOptionalString(entry.question);
					if (!question) {
						return null;
					}

					return {
						link: toOptionalUrl(entry.link),
						question,
						snippet: toOptionalString(entry.snippet),
						title: toOptionalString(entry.title)
					};
				})
				.filter(isDefined)
				.slice(0, 5)
		: [];

	const relatedSearches = Array.isArray(data.relatedSearches)
		? data.relatedSearches
				.map((entry): SerperRelatedSearchResult | null => {
					if (!isRecord(entry)) {
						return null;
					}

					const relatedQuery = toOptionalString(entry.query);
					return relatedQuery ? { query: relatedQuery } : null;
				})
				.filter(isDefined)
				.slice(0, 6)
		: [];

	const totalResults =
		toOptionalNumber(isRecord(data.searchInformation) ? data.searchInformation.totalResults : undefined) ??
		organic.length;

	return serperOutputSchema.parse({
		answerBox: answerBox && Object.values(answerBox).some((value) => value !== undefined) ? answerBox : undefined,
		knowledgeGraph:
			knowledgeGraph && Object.values(knowledgeGraph).some((value) => value !== undefined) ? knowledgeGraph : undefined,
		organic,
		peopleAlsoAsk,
		relatedSearches,
		searchParameters: { q: query },
		totalResults
	});
};

const buildSerperModelOutput = (output: SerperToolOutput): string => {
	let answerBoxSummary: string | undefined;

	if (output.answerBox?.answer) {
		answerBoxSummary = `Answer box: ${output.answerBox.answer}`;
	} else if (output.answerBox?.snippet) {
		answerBoxSummary = `Answer box: ${output.answerBox.snippet}`;
	}

	let knowledgeGraphSummary: string | undefined;
	if (output.knowledgeGraph?.title) {
		const typeSuffix = output.knowledgeGraph.type ? ` (${output.knowledgeGraph.type})` : "";
		const descriptionSuffix = output.knowledgeGraph.description ? ` - ${output.knowledgeGraph.description}` : "";
		knowledgeGraphSummary = `Knowledge graph: ${output.knowledgeGraph.title}${typeSuffix}${descriptionSuffix}`;
	}

	const organicSummary =
		output.organic.length > 0
			? [
					"Top search results:",
					...output.organic
						.slice(0, 5)
						.map((result: SerperOrganicResult) => `${result.position}. ${result.title} - ${result.snippet} (${result.link})`)
				].join("\n")
			: "No organic search results were returned.";

	const sections = [
		`Web search query: ${output.searchParameters.q}`,
		answerBoxSummary,
		knowledgeGraphSummary,
		organicSummary,
		output.peopleAlsoAsk.length > 0
			? `People also ask: ${output.peopleAlsoAsk.map((entry: SerperPeopleAlsoAskResult) => entry.question).join("; ")}`
			: undefined,
		output.relatedSearches.length > 0
			? `Related searches: ${output.relatedSearches.map((entry: SerperRelatedSearchResult) => entry.query).join("; ")}`
			: undefined
	];

	return sections.filter((section): section is string => Boolean(section)).join("\n\n");
};

export const tools = {
	serper: tool<SerperToolInput, SerperToolOutput, {}>({
		description:
			"Search the live web for up-to-date factual information. Use this for recent news, current product or company details, changing regulations, or anything that may have changed after training. Returns summarized search results and links, not full page contents.",
		inputExamples: [{ input: { q: "latest OpenAI API Responses API docs" } }, { input: { q: "site:kubernetes.io pod disruption budget v1 docs" } }],
		inputSchema: zodSchema(serperInputSchema),
		outputSchema: zodSchema(serperOutputSchema),
		execute: async ({ q }, { abortSignal }) => {
			const apiKey = env.SERPER_API_KEY;
			if (!apiKey) {
				throw new Error("SERPER_API_KEY is not configured");
			}

			const response = await fetch("https://google.serper.dev/search", {
				body: JSON.stringify({ q }),
				headers: {
					"Content-Type": "application/json",
					"X-API-KEY": apiKey
				},
				method: "POST",
				signal: abortSignal
			});

			if (!response.ok) {
				throw new Error(`Serper API error: ${response.status}`);
			}

			return normalizeSerperOutput(q, await response.json());
		},
		needsApproval: true,
		strict: true,
		title: "Web Search",
		toModelOutput: async ({ output }) => ({
			type: "text",
			value: buildSerperModelOutput(output)
		})
	})
};

export const getActiveTools = (toolNames: EnabledRequestToolId[] = []): EnabledRequestToolId[] =>
	Array.from(new Set(toolNames.filter((toolName) => toolName in tools)));
