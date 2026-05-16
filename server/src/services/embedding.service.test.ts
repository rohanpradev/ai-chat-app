import { beforeEach, describe, expect, it, mock } from "bun:test";
import { MockEmbeddingModelV4 } from "ai/test";

type DoEmbedOptions = Parameters<MockEmbeddingModelV4["doEmbed"]>[0];
type StoredValue = Record<string, unknown>;

let currentEmbeddingModel: MockEmbeddingModelV4;
let embeddingModelIds: string[] = [];
let insertedDocumentValues: StoredValue | undefined;
let insertedChunkValues: StoredValue[] = [];
let searchRows: StoredValue[] = [];

const openaiEmbeddingMock = mock((modelId: string) => {
	embeddingModelIds.push(modelId);
	return currentEmbeddingModel;
});

const createStoredDocument = (values: StoredValue) => ({
	byteSize: values.byteSize,
	checksum: values.checksum,
	chunkCount: values.chunkCount,
	contentType: values.contentType,
	createdAt: values.createdAt,
	embeddingDimensions: values.embeddingDimensions,
	embeddingModel: values.embeddingModel,
	id: "doc_test",
	metadata: values.metadata,
	sourceName: values.sourceName,
	sourceType: values.sourceType,
	title: values.title,
	updatedAt: values.updatedAt,
	userId: values.userId
});

const createStoredChunk = (values: StoredValue, index: number) => ({
	chunkIndex: values.chunkIndex,
	content: values.content,
	createdAt: values.createdAt,
	documentId: values.documentId,
	id: `chunk_${index + 1}`,
	metadata: values.metadata,
	tokenEstimate: values.tokenEstimate
});

const tx = {
	insert: mock(() => ({
		values: mock((values: StoredValue | StoredValue[]) => ({
			returning: mock(async () => {
				if (Array.isArray(values)) {
					insertedChunkValues = values;
					return values.map(createStoredChunk);
				}

				insertedDocumentValues = values;
				return [createStoredDocument(values)];
			})
		}))
	}))
};

const listBuilder = {
	from: () => ({
		where: () => ({
			orderBy: async () => []
		})
	})
};

const searchBuilder = {
	from: () => ({
		innerJoin: () => ({
			where: async () => searchRows
		})
	})
};

mock.module("@ai-sdk/openai", () => ({
	openai: {
		embedding: openaiEmbeddingMock
	}
}));

mock.module("@/db", () => ({
	db: {
		delete: mock(() => ({
			where: () => ({
				returning: async () => []
			})
		})),
		select: mock((selection?: unknown) => (selection ? searchBuilder : listBuilder)),
		transaction: mock(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx))
	}
}));

const paragraph = (label: string) => `${label}: ${"semantic retrieval context ".repeat(34)}${label} conclusion.`;

beforeEach(() => {
	embeddingModelIds = [];
	insertedDocumentValues = undefined;
	insertedChunkValues = [];
	searchRows = [];
	currentEmbeddingModel = new MockEmbeddingModelV4({
		doEmbed: async ({ values }: DoEmbedOptions) => ({
			embeddings: values.map((_, index) => [index + 1, index + 0.25, index + 0.5]),
			usage: { tokens: values.length * 11 },
			warnings: []
		}),
		maxEmbeddingsPerCall: null,
		modelId: "text-embedding-3-small",
		provider: "openai"
	});
});

describe("embedding service", () => {
	it("stores batch embeddings in the same order returned by AI SDK embedMany", async () => {
		const { createEmbeddingDocument } = await import("@/services/embedding.service");
		const abortController = new AbortController();
		const result = await createEmbeddingDocument({
			abortSignal: abortController.signal,
			byteSize: 4096,
			content: [paragraph("alpha"), paragraph("beta"), paragraph("gamma")].join("\n\n"),
			contentType: "text/markdown",
			metadata: { source: "unit-test" },
			sourceName: "embedding-notes.md",
			sourceType: "markdown",
			title: "Embedding Notes",
			userId: "00000000-0000-0000-0000-000000000001"
		});

		expect(embeddingModelIds).toEqual(["text-embedding-3-small"]);
		expect(currentEmbeddingModel.doEmbedCalls).toHaveLength(1);
		expect(currentEmbeddingModel.doEmbedCalls[0]?.abortSignal).toBe(abortController.signal);
		expect(currentEmbeddingModel.doEmbedCalls[0]?.values).toHaveLength(3);
		expect(currentEmbeddingModel.doEmbedCalls[0]?.values[0]).toContain("alpha");
		expect(currentEmbeddingModel.doEmbedCalls[0]?.values[1]).toContain("beta");
		expect(currentEmbeddingModel.doEmbedCalls[0]?.values[2]).toContain("gamma");

		expect(insertedDocumentValues?.embeddingDimensions).toBe(3);
		expect(insertedDocumentValues?.embeddingModel).toBe("text-embedding-3-small");
		expect(insertedDocumentValues?.chunkCount).toBe(3);
		expect(insertedChunkValues.map((chunk) => chunk.embedding)).toEqual([
			[1, 0.25, 0.5],
			[2, 1.25, 1.5],
			[3, 2.25, 2.5]
		]);
		expect(result.usage).toEqual({ tokens: 33 });
		expect(result.dimensions).toBe(3);
		expect(result.document.id).toBe("doc_test");
	});

	it("embeds search queries once and ranks stored chunks by cosine similarity", async () => {
		currentEmbeddingModel = new MockEmbeddingModelV4({
			doEmbed: async ({ values }: DoEmbedOptions) => ({
				embeddings: values.map(() => [1, 0]),
				usage: { tokens: 7 },
				warnings: []
			}),
			modelId: "text-embedding-3-small",
			provider: "openai"
		});
		searchRows = [
			{
				chunkId: "chunk_related",
				chunkIndex: 1,
				content: "Related context",
				documentId: "doc_a",
				embedding: [0.6, 0.8],
				sourceName: "related.md",
				title: "Related"
			},
			{
				chunkId: "chunk_exact",
				chunkIndex: 0,
				content: "Exact context",
				documentId: "doc_a",
				embedding: [1, 0],
				sourceName: "exact.md",
				title: "Exact"
			},
			{
				chunkId: "chunk_unrelated",
				chunkIndex: 2,
				content: "Unrelated context",
				documentId: "doc_b",
				embedding: [0, 1],
				sourceName: "unrelated.md",
				title: "Unrelated"
			}
		];

		const { searchEmbeddings } = await import("@/services/embedding.service");
		const result = await searchEmbeddings("00000000-0000-0000-0000-000000000001", {
			includeContent: true,
			limit: 2,
			minScore: 0.5,
			query: "find the exact context"
		});

		expect(embeddingModelIds).toEqual(["text-embedding-3-small"]);
		expect(currentEmbeddingModel.doEmbedCalls).toHaveLength(1);
		expect(currentEmbeddingModel.doEmbedCalls[0]?.values).toEqual(["find the exact context"]);
		expect(result.dimensions).toBe(2);
		expect(result.results.map((item) => item.chunkId)).toEqual(["chunk_exact", "chunk_related"]);
		expect(result.results[0]?.score).toBeCloseTo(1, 5);
		expect(result.results[1]?.score).toBeCloseTo(0.6, 5);
		expect(result.results[0]?.content).toBe("Exact context");
	});
});
