import {
	CommonBadRequestResponseSchema,
	CommonNotFoundResponseSchema,
	CommonUnauthorizedResponseSchema,
	EmbeddingDeleteResponseSchema,
	EmbeddingDocumentsResponseSchema,
	EmbeddingIngestResponseSchema,
	EmbeddingIngestTextRequestSchema,
	EmbeddingSearchRequestSchema,
	EmbeddingSearchResponseSchema,
	EmbeddingUploadRequestSchema,
	RagRequestSchema,
	RagResponseSchema
} from "@chat-app/shared";
import { createRoute, z } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { MAX_EMBEDDING_UPLOAD_BYTES } from "@/lib/embedding-config";
import { asRouteMiddleware } from "@/lib/hono-compat";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import { jsonContent } from "@/lib/openapi";
import { authMiddleware } from "@/middlewares/auth-middleware";

const tags = ["Embeddings"];
const authenticated = asRouteMiddleware(authMiddleware);
const uploadBodyLimit = asRouteMiddleware(
	bodyLimit({
		maxSize: MAX_EMBEDDING_UPLOAD_BYTES + 1024 * 1024,
		onError: (c) =>
			c.json(
				{
					message: `Upload payload must be smaller than ${Math.floor(MAX_EMBEDDING_UPLOAD_BYTES / 1024 / 1024)}MB`
				},
				HttpStatusCodes.PAYLOAD_TOO_LARGE
			)
	})
);

const documentParamsSchema = z.object({
	id: z.string().min(1).describe("Embedding document ID")
});

export const listDocuments = createRoute({
	description: "List documents vectorized by the authenticated user",
	method: "get",
	middleware: [authenticated],
	path: "/embeddings/documents",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(EmbeddingDocumentsResponseSchema, "Vectorized documents"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "List vectorized documents",
	tags
});

export const deleteDocument = createRoute({
	description: "Delete a vectorized document and all stored chunks",
	method: "delete",
	middleware: [authenticated],
	path: "/embeddings/documents/{id}",
	request: {
		params: documentParamsSchema
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(EmbeddingDeleteResponseSchema, "Deleted document"),
		[HttpStatusCodes.NOT_FOUND]: jsonContent(CommonNotFoundResponseSchema, "Document not found"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Delete a vectorized document",
	tags
});

export const ingestText = createRoute({
	description: "Vectorize plain text, markdown, JSON, or other text-like content",
	method: "post",
	middleware: [authenticated],
	path: "/embeddings/ingest",
	request: {
		body: jsonContent(EmbeddingIngestTextRequestSchema, "Text content to vectorize")
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(EmbeddingIngestResponseSchema, "Vectorized document"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(CommonBadRequestResponseSchema, "Invalid request payload"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Vectorize text content",
	tags
});

export const uploadDocument = createRoute({
	description: "Upload a PDF or text-like file, extract text, split it into chunks, and store embeddings",
	method: "post",
	middleware: [authenticated, uploadBodyLimit],
	path: "/embeddings/upload",
	request: {
		body: {
			content: {
				"multipart/form-data": {
					schema: EmbeddingUploadRequestSchema
				}
			},
			description: "PDF or text-like file upload"
		}
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(EmbeddingIngestResponseSchema, "Vectorized uploaded document"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(CommonBadRequestResponseSchema, "Invalid upload"),
		[HttpStatusCodes.PAYLOAD_TOO_LARGE]: jsonContent(CommonBadRequestResponseSchema, "Upload too large"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Upload and vectorize a document",
	tags
});

export const searchEmbeddings = createRoute({
	description: "Embed a query and return the most similar stored document chunks",
	method: "post",
	middleware: [authenticated],
	path: "/embeddings/search",
	request: {
		body: jsonContent(EmbeddingSearchRequestSchema, "Semantic search request")
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(EmbeddingSearchResponseSchema, "Semantic search results"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(CommonBadRequestResponseSchema, "Invalid request payload"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Search vectorized content",
	tags
});

export const rag = createRoute({
	description: "Retrieve matching embedded chunks and generate a grounded answer with citations",
	method: "post",
	middleware: [authenticated],
	path: "/embeddings/rag",
	request: {
		body: jsonContent(RagRequestSchema, "RAG request")
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(RagResponseSchema, "Grounded answer with source chunks"),
		[HttpStatusCodes.BAD_REQUEST]: jsonContent(CommonBadRequestResponseSchema, "Invalid request payload"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(CommonUnauthorizedResponseSchema, "Unauthorized")
	},
	security: [{ CookieAuth: [] }],
	summary: "Ask a RAG question over vectorized content",
	tags
});

export type ListDocumentsRoute = typeof listDocuments;
export type DeleteDocumentRoute = typeof deleteDocument;
export type IngestTextRoute = typeof ingestText;
export type UploadDocumentRoute = typeof uploadDocument;
export type SearchEmbeddingsRoute = typeof searchEmbeddings;
export type RagRoute = typeof rag;
