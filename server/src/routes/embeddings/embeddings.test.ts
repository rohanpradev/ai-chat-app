import { describe, expect, it, mock } from "bun:test";

const documentFixture = {
	byteSize: 128,
	chunkCount: 1,
	contentType: "text/plain",
	createdAt: "2026-05-14T00:00:00.000Z",
	embeddingDimensions: 1536,
	embeddingModel: "text-embedding-3-small",
	id: "doc_1",
	sourceName: "notes.txt",
	sourceType: "text",
	title: "Notes",
	updatedAt: "2026-05-14T00:00:00.000Z"
};

const ingestResultFixture = {
	chunks: [
		{
			chunkIndex: 0,
			content: "Hello embedded world",
			createdAt: "2026-05-14T00:00:00.000Z",
			documentId: "doc_1",
			id: "chunk_1",
			tokenEstimate: 5
		}
	],
	dimensions: 1536,
	document: documentFixture,
	model: "text-embedding-3-small",
	usage: { tokens: 5 }
};

const searchResultFixture = {
	dimensions: 1536,
	model: "text-embedding-3-small",
	query: "hello",
	results: [
		{
			chunkId: "chunk_1",
			chunkIndex: 0,
			content: "Hello embedded world",
			documentId: "doc_1",
			score: 0.91,
			sourceName: "notes.txt",
			title: "Notes"
		}
	]
};

const listEmbeddingDocumentsMock = mock(async () => [documentFixture]);
const createEmbeddingDocumentMock = mock(async () => ingestResultFixture);
const extractUploadContentMock = mock(async () => ({
	byteSize: 32,
	content: "Hello uploaded world",
	contentType: "text/plain",
	sourceName: "upload.txt",
	sourceType: "text",
	title: "Upload"
}));
const searchEmbeddingsMock = mock(async () => searchResultFixture);
const answerWithRagMock = mock(async () => ({
	answer: "Grounded answer [1]",
	model: "gpt-5-mini",
	query: "hello",
	sources: searchResultFixture.results
}));
const deleteEmbeddingDocumentMock = mock(async () => ({ id: "doc_1" }));

mock.module("@/middlewares/auth-middleware", () => ({
	authMiddleware: mock(async (c, next) => {
		c.set("jwtPayload", { sub: { id: "test-user" } });
		await next();
	})
}));

mock.module("@/services/embedding.service", () => ({
	answerWithRag: answerWithRagMock,
	createEmbeddingDocument: createEmbeddingDocumentMock,
	deleteEmbeddingDocument: deleteEmbeddingDocumentMock,
	extractUploadContent: extractUploadContentMock,
	inferEmbeddingSourceType: () => "text",
	listEmbeddingDocuments: listEmbeddingDocumentsMock,
	searchEmbeddings: searchEmbeddingsMock
}));

describe("Embedding Routes", () => {
	it("lists vectorized documents", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/embeddings/embeddings.index");
		const app = createApp().route("/", router);
		const response = await app.request("/embeddings/documents");

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.data).toEqual([documentFixture]);
	});

	it("ingests text content", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/embeddings/embeddings.index");
		const app = createApp().route("/", router);
		const response = await app.request("/embeddings/ingest", {
			body: JSON.stringify({
				content: "Hello embedded world",
				title: "Notes"
			}),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});

		expect(response.status).toBe(201);
		const payload = await response.json();
		expect(payload.data.document.id).toBe("doc_1");
		expect(createEmbeddingDocumentMock).toHaveBeenCalled();
	});

	it("uploads multipart files", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/embeddings/embeddings.index");
		const app = createApp().route("/", router);
		const formData = new FormData();
		formData.append("file", new File(["Hello uploaded world"], "upload.txt", { type: "text/plain" }));
		formData.append("title", "Upload");

		const response = await app.request("/embeddings/upload", {
			body: formData,
			headers: { Origin: "http://localhost:5173" },
			method: "POST"
		});

		expect(response.status).toBe(201);
		const payload = await response.json();
		expect(payload.data.document.title).toBe("Notes");
		expect(extractUploadContentMock).toHaveBeenCalled();
	});

	it("searches vectorized chunks", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/embeddings/embeddings.index");
		const app = createApp().route("/", router);
		const response = await app.request("/embeddings/search", {
			body: JSON.stringify({ query: "hello" }),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.data.results[0].score).toBe(0.91);
	});

	it("answers RAG questions", async () => {
		const { createApp } = await import("@/lib/create-app");
		const { default: router } = await import("@/routes/embeddings/embeddings.index");
		const app = createApp().route("/", router);
		const response = await app.request("/embeddings/rag", {
			body: JSON.stringify({ query: "hello" }),
			headers: { "Content-Type": "application/json" },
			method: "POST"
		});

		expect(response.status).toBe(200);
		const payload = await response.json();
		expect(payload.data.answer).toBe("Grounded answer [1]");
	});
});
