import { EmbeddingUploadRequestSchema } from "@chat-app/shared";
import { HTTPException } from "hono/http-exception";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import type { AppRouteHandler } from "@/lib/types";
import type {
	DeleteDocumentRoute,
	IngestTextRoute,
	ListDocumentsRoute,
	RagRoute,
	SearchEmbeddingsRoute,
	UploadDocumentRoute
} from "@/routes/embeddings/embeddings.route";
import {
	answerWithRag,
	createEmbeddingDocument,
	deleteEmbeddingDocument,
	extractUploadContent,
	inferEmbeddingSourceType,
	listEmbeddingDocuments,
	searchEmbeddings as searchEmbeddingService
} from "@/services/embedding.service";

const textEncoder = new TextEncoder();

const getUserId = (c: Parameters<AppRouteHandler<ListDocumentsRoute>>[0]) => c.get("jwtPayload").sub.id;

const asBadRequest = (error: unknown, fallback: string) =>
	new HTTPException(HttpStatusCodes.BAD_REQUEST, {
		message: error instanceof Error ? error.message : fallback
	});

export const listDocuments: AppRouteHandler<ListDocumentsRoute> = async (c) => {
	const documents = await listEmbeddingDocuments(getUserId(c));

	return c.json({
		data: documents,
		message: "Vectorized documents retrieved successfully"
	});
};

export const deleteDocument: AppRouteHandler<DeleteDocumentRoute> = async (c) => {
	const userId = getUserId(c);
	const { id } = c.req.valid("param");
	const deletedDocument = await deleteEmbeddingDocument(userId, id);

	if (!deletedDocument) {
		throw new HTTPException(HttpStatusCodes.NOT_FOUND, { message: "Embedding document not found" });
	}

	return c.json({
		data: deletedDocument,
		message: "Embedding document deleted successfully"
	});
};

export const ingestText: AppRouteHandler<IngestTextRoute> = async (c) => {
	const requestBody = c.req.valid("json");

	try {
		const result = await createEmbeddingDocument({
			abortSignal: c.req.raw.signal,
			byteSize: textEncoder.encode(requestBody.content).byteLength,
			content: requestBody.content,
			contentType: requestBody.contentType,
			metadata: requestBody.metadata,
			sourceName: requestBody.sourceName,
			sourceType: inferEmbeddingSourceType(requestBody.contentType, requestBody.sourceName),
			title: requestBody.title,
			userId: getUserId(c)
		});

		return c.json(
			{
				data: result,
				message: "Content vectorized successfully"
			},
			HttpStatusCodes.CREATED
		);
	} catch (error) {
		throw asBadRequest(error, "Failed to vectorize content");
	}
};

export const uploadDocument: AppRouteHandler<UploadDocumentRoute> = async (c) => {
	const parsed = EmbeddingUploadRequestSchema.safeParse(await c.req.parseBody());
	if (!parsed.success) {
		throw asBadRequest(parsed.error, "Invalid upload payload");
	}

	try {
		const extracted = await extractUploadContent(parsed.data.file, {
			metadata: parsed.data.metadata,
			title: parsed.data.title
		});
		const result = await createEmbeddingDocument({
			...extracted,
			abortSignal: c.req.raw.signal,
			userId: getUserId(c)
		});

		return c.json(
			{
				data: result,
				message: "Document uploaded and vectorized successfully"
			},
			HttpStatusCodes.CREATED
		);
	} catch (error) {
		throw asBadRequest(error, "Failed to vectorize uploaded document");
	}
};

export const searchEmbeddings: AppRouteHandler<SearchEmbeddingsRoute> = async (c) => {
	const requestBody = c.req.valid("json");

	try {
		const result = await searchEmbeddingService(getUserId(c), requestBody, c.req.raw.signal);

		return c.json({
			data: result,
			message: "Embedding search completed successfully"
		});
	} catch (error) {
		throw asBadRequest(error, "Embedding search failed");
	}
};

export const rag: AppRouteHandler<RagRoute> = async (c) => {
	const requestBody = c.req.valid("json");

	try {
		const result = await answerWithRag(getUserId(c), requestBody, c.req.raw.signal);

		return c.json({
			data: result,
			message: "RAG answer generated successfully"
		});
	} catch (error) {
		throw asBadRequest(error, "RAG answer generation failed");
	}
};
