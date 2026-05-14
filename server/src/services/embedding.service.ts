import { createHash } from "node:crypto";
import { openai } from "@ai-sdk/openai";
import type { EmbeddingDocument, EmbeddingSearchRequest, EmbeddingSearchResult, RagRequest } from "@chat-app/shared";
import { cosineSimilarity, embed, embedMany, generateText } from "ai";
import { and, desc, eq } from "drizzle-orm";
import { extractText, getDocumentProxy } from "unpdf";
import { db } from "@/db";
import { embeddingChunks, embeddingDocuments } from "@/db/schema";
import { EMBEDDING_MODEL_ID, MAX_EMBEDDING_UPLOAD_BYTES, MAX_EXTRACTED_TEXT_CHARS } from "@/lib/embedding-config";
import { resolveModel, resolveModelSelection } from "@/utils/index";

type SourceType = EmbeddingDocument["sourceType"];

interface CreateEmbeddingDocumentInput {
	abortSignal?: AbortSignal;
	byteSize: number;
	content: string;
	contentType: string;
	metadata?: Record<string, unknown>;
	sourceName?: string;
	sourceType: SourceType;
	title?: string;
	userId: string;
}

interface ExtractedUploadContent {
	byteSize: number;
	content: string;
	contentType: string;
	metadata?: Record<string, unknown>;
	sourceName: string;
	sourceType: SourceType;
	title: string;
}

const CHUNK_TARGET_CHARS = 1_600;
const CHUNK_OVERLAP_CHARS = 240;
const MIN_CHUNK_CHARS = 120;
const EMBEDDING_MAX_PARALLEL_CALLS = 3;

const ALLOWED_UPLOAD_EXTENSIONS = new Set([
	".c",
	".cpp",
	".csv",
	".css",
	".html",
	".java",
	".js",
	".json",
	".jsx",
	".md",
	".pdf",
	".py",
	".ts",
	".tsx",
	".txt",
	".xml"
]);

const ALLOWED_UPLOAD_MIME_TYPES = new Set([
	"application/javascript",
	"application/json",
	"application/pdf",
	"application/xml",
	"text/css",
	"text/csv",
	"text/html",
	"text/javascript",
	"text/markdown",
	"text/plain",
	"text/xml"
]);

const extensionFromName = (filename: string) => {
	const lastDot = filename.lastIndexOf(".");
	return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : "";
};

const normalizeContentType = (contentType: string | undefined, sourceName?: string) => {
	if (contentType?.trim()) {
		return contentType.toLowerCase();
	}

	const extension = sourceName ? extensionFromName(sourceName) : "";
	switch (extension) {
		case ".pdf":
			return "application/pdf";
		case ".md":
			return "text/markdown";
		case ".json":
			return "application/json";
		case ".html":
			return "text/html";
		case ".csv":
			return "text/csv";
		case ".xml":
			return "application/xml";
		case ".css":
			return "text/css";
		case ".js":
		case ".jsx":
		case ".ts":
		case ".tsx":
			return "text/javascript";
		default:
			return "text/plain";
	}
};

const inferSourceType = (contentType: string, sourceName?: string): SourceType => {
	const extension = sourceName ? extensionFromName(sourceName) : "";

	if (contentType === "application/pdf" || extension === ".pdf") {
		return "pdf";
	}

	if (contentType === "text/markdown" || extension === ".md") {
		return "markdown";
	}

	if (contentType === "application/json" || extension === ".json") {
		return "json";
	}

	if (contentType === "text/html" || extension === ".html") {
		return "html";
	}

	if (contentType === "text/csv" || extension === ".csv") {
		return "csv";
	}

	if ([".c", ".cpp", ".css", ".java", ".js", ".jsx", ".py", ".ts", ".tsx"].includes(extension)) {
		return "code";
	}

	if (contentType.startsWith("text/") || extension === ".txt") {
		return "text";
	}

	return "other";
};

export const inferEmbeddingSourceType = inferSourceType;

const isAllowedUpload = (file: File) => {
	const extension = extensionFromName(file.name);
	const contentType = normalizeContentType(file.type, file.name);

	return ALLOWED_UPLOAD_MIME_TYPES.has(contentType) || ALLOWED_UPLOAD_EXTENSIONS.has(extension);
};

const sanitizeTitle = (title: string | undefined, sourceName: string | undefined) => {
	const candidate = title?.trim() || sourceName?.trim() || "Untitled document";
	return candidate.slice(0, 200);
};

const normalizeText = (content: string) =>
	content
		.replaceAll("\u0000", "")
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n{4,}/g, "\n\n\n")
		.trim();

const estimateTokens = (content: string) => Math.max(1, Math.ceil(content.length / 4));

const takeOverlap = (content: string) => {
	const tail = content.slice(-CHUNK_OVERLAP_CHARS);
	const firstWhitespace = tail.search(/\s/);
	return firstWhitespace > 0 ? tail.slice(firstWhitespace).trimStart() : tail.trimStart();
};

const splitOversizedUnit = (unit: string) => {
	const chunks: string[] = [];
	const step = CHUNK_TARGET_CHARS - CHUNK_OVERLAP_CHARS;

	for (let start = 0; start < unit.length; start += step) {
		chunks.push(unit.slice(start, start + CHUNK_TARGET_CHARS).trim());
	}

	return chunks.filter((chunk) => chunk.length > 0);
};

const chunkDocumentText = (content: string) => {
	const normalized = normalizeText(content);
	const units = normalized
		.split(/(?<=\n\n)|(?<=[.!?])\s+/)
		.map((unit) => unit.trim())
		.filter(Boolean);
	const chunks: string[] = [];
	let current = "";

	const pushCurrent = () => {
		const trimmed = current.trim();
		if (trimmed.length > 0) {
			chunks.push(trimmed);
		}
		current = trimmed.length >= MIN_CHUNK_CHARS ? takeOverlap(trimmed) : "";
	};

	for (const unit of units) {
		if (unit.length > CHUNK_TARGET_CHARS) {
			if (current.trim()) {
				pushCurrent();
			}
			chunks.push(...splitOversizedUnit(unit));
			current = takeOverlap(unit);
			continue;
		}

		const separator = current ? "\n\n" : "";
		if ((current + separator + unit).length > CHUNK_TARGET_CHARS) {
			pushCurrent();
		}

		current = [current, unit].filter(Boolean).join("\n\n");
	}

	if (current.trim()) {
		chunks.push(current.trim());
	}

	return chunks
		.map((chunk) => normalizeText(chunk))
		.filter((chunk, index, array) => chunk.length > 0 && (chunk.length >= MIN_CHUNK_CHARS || index === array.length - 1))
		.map((chunk, chunkIndex) => ({
			chunkIndex,
			content: chunk,
			tokenEstimate: estimateTokens(chunk)
		}));
};

const hashContent = (content: string) => createHash("sha256").update(content).digest("hex");

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

const toPublicDocument = (document: typeof embeddingDocuments.$inferSelect): EmbeddingDocument => ({
	byteSize: document.byteSize,
	chunkCount: document.chunkCount,
	contentType: document.contentType,
	createdAt: toIso(document.createdAt),
	embeddingDimensions: document.embeddingDimensions,
	embeddingModel: document.embeddingModel,
	id: document.id,
	...(document.metadata ? { metadata: document.metadata } : {}),
	...(document.sourceName ? { sourceName: document.sourceName } : {}),
	sourceType: document.sourceType as SourceType,
	title: document.title,
	updatedAt: toIso(document.updatedAt)
});

const metadataFromString = (metadata?: string) => {
	if (!metadata?.trim()) {
		return undefined;
	}

	const parsed = JSON.parse(metadata) as unknown;
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Metadata must be a JSON object");
	}

	return parsed as Record<string, unknown>;
};

const assertExtractedText = (content: string) => {
	const normalized = normalizeText(content);
	if (!normalized) {
		throw new Error("No extractable text was found in the document");
	}

	if (normalized.length > MAX_EXTRACTED_TEXT_CHARS) {
		throw new Error(`Extracted text is too large. Limit is ${MAX_EXTRACTED_TEXT_CHARS.toLocaleString()} characters`);
	}

	return normalized;
};

const extractPdfText = async (file: File) => {
	const buffer = new Uint8Array(await file.arrayBuffer());
	const pdf = await getDocumentProxy(buffer);

	try {
		const result = await extractText(pdf, { mergePages: true });
		return {
			metadata: { totalPages: result.totalPages },
			text: result.text
		};
	} finally {
		await pdf.destroy();
	}
};

export const extractUploadContent = async (file: File, options: { metadata?: string; title?: string }) => {
	if (file.size <= 0) {
		throw new Error("Uploaded file is empty");
	}

	if (file.size > MAX_EMBEDDING_UPLOAD_BYTES) {
		throw new Error(`Uploaded file must be smaller than ${Math.floor(MAX_EMBEDDING_UPLOAD_BYTES / 1024 / 1024)}MB`);
	}

	if (!isAllowedUpload(file)) {
		throw new Error("Upload must be a PDF or supported text-like file");
	}

	const contentType = normalizeContentType(file.type, file.name);
	const sourceType = inferSourceType(contentType, file.name);
	const baseMetadata = metadataFromString(options.metadata);
	const extracted =
		sourceType === "pdf"
			? await extractPdfText(file)
			: {
					metadata: undefined,
					text: await file.text()
				};

	return {
		byteSize: file.size,
		content: assertExtractedText(extracted.text),
		contentType,
		metadata: { ...baseMetadata, ...extracted.metadata },
		sourceName: file.name,
		sourceType,
		title: sanitizeTitle(options.title, file.name)
	} satisfies ExtractedUploadContent;
};

export const createEmbeddingDocument = async ({
	abortSignal,
	byteSize,
	content,
	contentType,
	metadata,
	sourceName,
	sourceType,
	title,
	userId
}: CreateEmbeddingDocumentInput) => {
	const normalizedContent = assertExtractedText(content);
	const chunks = chunkDocumentText(normalizedContent);
	if (chunks.length === 0) {
		throw new Error("No chunks could be produced from the document");
	}

	const embeddingResult = await embedMany({
		abortSignal,
		maxParallelCalls: EMBEDDING_MAX_PARALLEL_CALLS,
		model: openai.embedding(EMBEDDING_MODEL_ID),
		values: chunks.map((chunk) => chunk.content)
	});
	const [firstEmbedding] = embeddingResult.embeddings;
	if (!firstEmbedding) {
		throw new Error("Embedding provider returned no vectors");
	}

	const now = new Date();
	const checksum = hashContent(normalizedContent);
	const [storedDocument, storedChunks] = await db.transaction(async (tx) => {
		const [document] = await tx
			.insert(embeddingDocuments)
			.values({
				byteSize,
				checksum,
				chunkCount: chunks.length,
				contentType,
				createdAt: now,
				embeddingDimensions: firstEmbedding.length,
				embeddingModel: EMBEDDING_MODEL_ID,
				metadata,
				sourceName,
				sourceType,
				title: sanitizeTitle(title, sourceName),
				updatedAt: now,
				userId
			})
			.returning();

		if (!document) {
			throw new Error("Failed to store embedding document");
		}

		const insertedChunks = await tx
			.insert(embeddingChunks)
			.values(
				chunks.map((chunk, index) => ({
					chunkIndex: chunk.chunkIndex,
					content: chunk.content,
					createdAt: now,
					documentId: document.id,
					embedding: embeddingResult.embeddings[index] ?? [],
					metadata: {
						...(metadata ?? {}),
						approximateTokens: chunk.tokenEstimate
					},
					tokenEstimate: chunk.tokenEstimate,
					userId
				}))
			)
			.returning({
				chunkIndex: embeddingChunks.chunkIndex,
				content: embeddingChunks.content,
				createdAt: embeddingChunks.createdAt,
				documentId: embeddingChunks.documentId,
				id: embeddingChunks.id,
				metadata: embeddingChunks.metadata,
				tokenEstimate: embeddingChunks.tokenEstimate
			});

		return [document, insertedChunks] as const;
	});

	return {
		chunks: storedChunks.map((chunk) => ({
			chunkIndex: chunk.chunkIndex,
			content: chunk.content,
			createdAt: toIso(chunk.createdAt),
			documentId: chunk.documentId,
			id: chunk.id,
			...(chunk.metadata ? { metadata: chunk.metadata } : {}),
			tokenEstimate: chunk.tokenEstimate
		})),
		dimensions: firstEmbedding.length,
		document: toPublicDocument(storedDocument),
		model: EMBEDDING_MODEL_ID,
		usage: embeddingResult.usage
	};
};

export const listEmbeddingDocuments = async (userId: string) => {
	const documents = await db
		.select()
		.from(embeddingDocuments)
		.where(eq(embeddingDocuments.userId, userId))
		.orderBy(desc(embeddingDocuments.updatedAt));

	return documents.map(toPublicDocument);
};

export const deleteEmbeddingDocument = async (userId: string, documentId: string) => {
	const [deletedDocument] = await db
		.delete(embeddingDocuments)
		.where(and(eq(embeddingDocuments.id, documentId), eq(embeddingDocuments.userId, userId)))
		.returning({ id: embeddingDocuments.id });

	return deletedDocument;
};

export const searchEmbeddings = async (userId: string, request: EmbeddingSearchRequest, abortSignal?: AbortSignal) => {
	const queryEmbedding = await embed({
		abortSignal,
		model: openai.embedding(EMBEDDING_MODEL_ID),
		value: request.query
	});
	const filters = [eq(embeddingChunks.userId, userId)];
	if (request.documentId) {
		filters.push(eq(embeddingChunks.documentId, request.documentId));
	}

	const rows = await db
		.select({
			chunkId: embeddingChunks.id,
			chunkIndex: embeddingChunks.chunkIndex,
			content: embeddingChunks.content,
			documentId: embeddingChunks.documentId,
			embedding: embeddingChunks.embedding,
			sourceName: embeddingDocuments.sourceName,
			title: embeddingDocuments.title
		})
		.from(embeddingChunks)
		.innerJoin(embeddingDocuments, eq(embeddingChunks.documentId, embeddingDocuments.id))
		.where(and(...filters));

	const results = rows
		.map((row): EmbeddingSearchResult => {
			const score = cosineSimilarity(queryEmbedding.embedding, row.embedding);

			return {
				chunkId: row.chunkId,
				chunkIndex: row.chunkIndex,
				...(request.includeContent ? { content: row.content } : {}),
				documentId: row.documentId,
				score,
				...(row.sourceName ? { sourceName: row.sourceName } : {}),
				title: row.title
			};
		})
		.filter((result) => result.score >= request.minScore)
		.sort((first, second) => second.score - first.score)
		.slice(0, request.limit);

	return {
		dimensions: queryEmbedding.embedding.length,
		model: EMBEDDING_MODEL_ID,
		query: request.query,
		results
	};
};

const buildRagPrompt = (query: string, sources: EmbeddingSearchResult[]) => {
	const sourceText = sources
		.map((source, index) => {
			const label = `[${index + 1}] ${source.title}${source.sourceName ? ` (${source.sourceName})` : ""}`;
			return `${label}\n${source.content ?? ""}`;
		})
		.join("\n\n---\n\n");

	return [
		"Use the retrieved context to answer the question.",
		"Answer only from the context when possible. If the context is insufficient, say what is missing.",
		"Cite relevant chunks inline with bracket numbers like [1].",
		"",
		`Question: ${query}`,
		"",
		"Retrieved context:",
		sourceText || "No context retrieved."
	].join("\n");
};

export const answerWithRag = async (userId: string, request: RagRequest, abortSignal?: AbortSignal) => {
	const selectedModel = await resolveModelSelection(request.model);
	const search = await searchEmbeddings(
		userId,
		{
			documentId: request.documentId,
			includeContent: true,
			limit: request.limit,
			minScore: request.minScore,
			query: request.query
		},
		abortSignal
	);

	if (search.results.length === 0) {
		return {
			answer: "I could not find any matching embedded context for that question.",
			model: selectedModel.id,
			query: request.query,
			sources: []
		};
	}

	const answer = await generateText({
		abortSignal,
		model: resolveModel(selectedModel.id),
		prompt: buildRagPrompt(request.query, search.results),
		system:
			"You are a retrieval-augmented assistant. Be concise, grounded, and explicit about missing context. Do not invent citations.",
		temperature: 0.2
	});

	return {
		answer: answer.text,
		model: selectedModel.id,
		query: request.query,
		sources: search.results
	};
};
