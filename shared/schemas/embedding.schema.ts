import { z } from "@hono/zod-openapi";

export const embeddingSourceTypes = ["pdf", "text", "markdown", "json", "html", "csv", "code", "other"] as const;

export const EmbeddingMetadataSchema = z.record(z.string(), z.unknown()).openapi({
	description: "Caller-defined metadata stored with the embedded document",
	title: "EmbeddingMetadata",
});

export const EmbeddingDocumentSchema = z
	.object({
		byteSize: z.number().int().nonnegative().describe("Original uploaded or submitted content size in bytes"),
		chunkCount: z.number().int().nonnegative().describe("Number of vectorized chunks for this document"),
		contentType: z.string().describe("MIME type for the original content"),
		createdAt: z.iso.datetime().describe("Document creation timestamp"),
		embeddingDimensions: z.number().int().positive().describe("Embedding vector dimensions"),
		embeddingModel: z.string().describe("Embedding model used for the stored chunks"),
		id: z.string().describe("Document ID"),
		metadata: EmbeddingMetadataSchema.optional().describe("Optional caller-defined metadata"),
		sourceName: z.string().optional().describe("Original file name or logical source name"),
		sourceType: z.enum(embeddingSourceTypes).describe("Normalized source content type"),
		title: z.string().describe("Human-readable document title"),
		updatedAt: z.iso.datetime().describe("Document update timestamp"),
	})
	.openapi({
		description: "Vectorized document metadata",
		title: "EmbeddingDocument",
	});

export const EmbeddingChunkSchema = z
	.object({
		chunkIndex: z.number().int().nonnegative().describe("Zero-based chunk index within the document"),
		content: z.string().describe("Chunk text"),
		createdAt: z.iso.datetime().describe("Chunk creation timestamp"),
		documentId: z.string().describe("Parent document ID"),
		id: z.string().describe("Chunk ID"),
		metadata: EmbeddingMetadataSchema.optional().describe("Chunk-level metadata"),
		tokenEstimate: z.number().int().nonnegative().describe("Approximate token count for the chunk"),
	})
	.openapi({
		description: "Text chunk stored for vector search",
		title: "EmbeddingChunk",
	});

export const EmbeddingUsageSchema = z
	.object({
		tokens: z.number().int().nonnegative().optional().describe("Embedding input token usage if reported by provider"),
	})
	.openapi({
		description: "Embedding provider usage summary",
		title: "EmbeddingUsage",
	});

export const EmbeddingIngestTextRequestSchema = z
	.object({
		content: z.string().min(1).max(500_000).describe("Plain text or markdown content to vectorize"),
		contentType: z.string().optional().default("text/plain").describe("MIME type for the submitted content"),
		metadata: EmbeddingMetadataSchema.optional(),
		sourceName: z.string().max(255).optional().describe("Logical source name for this content"),
		title: z.string().min(1).max(200).optional().describe("Document title"),
	})
	.openapi({
		description: "Plain content ingestion request",
		title: "EmbeddingIngestTextRequest",
	});

export const EmbeddingUploadRequestSchema = z
	.object({
		file: z.instanceof(File).describe("PDF or text-like file to vectorize").openapi({ format: "binary", type: "string" }),
		metadata: z.string().optional().describe("Optional JSON object string with caller-defined metadata"),
		title: z.string().min(1).max(200).optional().describe("Document title override"),
	})
	.openapi({
		description: "Multipart document upload request",
		title: "EmbeddingUploadRequest",
	});

export const EmbeddingIngestResponseSchema = z
	.object({
		data: z.object({
			chunks: z.array(EmbeddingChunkSchema).describe("Stored chunks without vector payloads"),
			dimensions: z.number().int().positive().describe("Embedding vector dimensions"),
			document: EmbeddingDocumentSchema,
			model: z.string().describe("Embedding model used"),
			usage: EmbeddingUsageSchema.optional(),
		}),
		message: z.string().describe("Success message"),
	})
	.openapi({
		description: "Embedding ingestion result",
		title: "EmbeddingIngestResponse",
	});

export const EmbeddingSearchRequestSchema = z
	.object({
		documentId: z.string().optional().describe("Restrict search to one document"),
		includeContent: z.boolean().optional().default(true).describe("Whether to include chunk text in results"),
		limit: z.coerce.number().int().min(1).max(20).optional().default(8).describe("Maximum number of chunks to return"),
		minScore: z.coerce.number().min(-1).max(1).optional().default(0).describe("Minimum cosine similarity score"),
		query: z.string().min(1).max(4_000).describe("Search query to embed and match against stored chunks"),
	})
	.openapi({
		description: "Semantic embedding search request",
		title: "EmbeddingSearchRequest",
	});

export const EmbeddingSearchResultSchema = z
	.object({
		chunkId: z.string().describe("Matched chunk ID"),
		chunkIndex: z.number().int().nonnegative().describe("Zero-based chunk index in the document"),
		content: z.string().optional().describe("Matched chunk text"),
		documentId: z.string().describe("Matched document ID"),
		score: z.number().describe("Cosine similarity score"),
		sourceName: z.string().optional().describe("Original source file or logical source name"),
		title: z.string().describe("Document title"),
	})
	.openapi({
		description: "Semantic search match",
		title: "EmbeddingSearchResult",
	});

export const EmbeddingSearchResponseSchema = z
	.object({
		data: z.object({
			dimensions: z.number().int().positive().describe("Query embedding dimensions"),
			model: z.string().describe("Embedding model used"),
			query: z.string().describe("Original query"),
			results: z.array(EmbeddingSearchResultSchema),
		}),
		message: z.string().describe("Success message"),
	})
	.openapi({
		description: "Semantic embedding search response",
		title: "EmbeddingSearchResponse",
	});

export const EmbeddingDocumentsResponseSchema = z
	.object({
		data: z.array(EmbeddingDocumentSchema),
		message: z.string().describe("Success message"),
	})
	.openapi({
		description: "Vectorized document list",
		title: "EmbeddingDocumentsResponse",
	});

export const EmbeddingDeleteResponseSchema = z
	.object({
		data: z.object({ id: z.string().describe("Deleted document ID") }),
		message: z.string().describe("Success message"),
	})
	.openapi({
		description: "Embedding document deletion response",
		title: "EmbeddingDeleteResponse",
	});

export const RagRequestSchema = z
	.object({
		documentId: z.string().optional().describe("Restrict retrieval to one document"),
		limit: z.coerce.number().int().min(1).max(12).optional().default(6).describe("Maximum chunks to retrieve"),
		minScore: z.coerce.number().min(-1).max(1).optional().default(0).describe("Minimum retrieval similarity score"),
		model: z.string().min(1).optional().describe("Optional chat model to use for answer generation"),
		query: z.string().min(1).max(4_000).describe("Question to answer using embedded context"),
	})
	.openapi({
		description: "Retrieval-augmented generation request",
		title: "RagRequest",
	});

export const RagResponseSchema = z
	.object({
		data: z.object({
			answer: z.string().describe("Generated answer grounded in retrieved chunks"),
			model: z.string().describe("Chat model used for generation"),
			query: z.string().describe("Original question"),
			sources: z.array(EmbeddingSearchResultSchema).describe("Retrieved source chunks"),
		}),
		message: z.string().describe("Success message"),
	})
	.openapi({
		description: "Retrieval-augmented generation response",
		title: "RagResponse",
	});

export type EmbeddingDeleteResponse = z.infer<typeof EmbeddingDeleteResponseSchema>;
export type EmbeddingDocument = z.infer<typeof EmbeddingDocumentSchema>;
export type EmbeddingDocumentsResponse = z.infer<typeof EmbeddingDocumentsResponseSchema>;
export type EmbeddingIngestResponse = z.infer<typeof EmbeddingIngestResponseSchema>;
export type EmbeddingIngestTextRequest = z.infer<typeof EmbeddingIngestTextRequestSchema>;
export type EmbeddingSearchRequest = z.infer<typeof EmbeddingSearchRequestSchema>;
export type EmbeddingSearchResponse = z.infer<typeof EmbeddingSearchResponseSchema>;
export type EmbeddingSearchResult = z.infer<typeof EmbeddingSearchResultSchema>;
export type RagRequest = z.infer<typeof RagRequestSchema>;
export type RagResponse = z.infer<typeof RagResponseSchema>;
