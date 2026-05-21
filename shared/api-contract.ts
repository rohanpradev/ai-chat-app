import {
	AIEvaluationRequestSchema,
	type AIEvaluationResponse,
	AIPlanRequestSchema,
	type AIPlanResponse,
	type AvailableModelsResponse,
	ChatRequestSchema,
} from "@chat-app/shared/schemas/ai.schema";
import type {
	CreateConversationResponse,
	GetConversationResponse,
	GetConversationsResponse,
	UpdateConversationResponse,
} from "@chat-app/shared/schemas/chat.schema";
import { CreateConversationRequestSchema, UpdateConversationRequestSchema } from "@chat-app/shared/schemas/chat.schema";
import type {
	EmbeddingDeleteResponse,
	EmbeddingDocumentsResponse,
	EmbeddingIngestResponse,
	EmbeddingSearchResponse,
	RagResponse,
} from "@chat-app/shared/schemas/embedding.schema";
import {
	EmbeddingIngestTextRequestSchema,
	EmbeddingSearchRequestSchema,
	EmbeddingUploadRequestSchema,
	RagRequestSchema,
} from "@chat-app/shared/schemas/embedding.schema";
import type { GetProfileResponse, UpdateProfileResponse } from "@chat-app/shared/schemas/profile.schema";
import { UpdateProfileRequestSchema } from "@chat-app/shared/schemas/profile.schema";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

const routeParamsSchema = z.object({
	id: z.string(),
});

export const apiContract = new Hono()
	.get("/ai/models", (c) => c.json({} as AvailableModelsResponse, 200))
	.post("/ai/plan", zValidator("json", AIPlanRequestSchema), (c) => c.json({} as AIPlanResponse, 200))
	.post("/ai/evaluate", zValidator("json", AIEvaluationRequestSchema), (c) => c.json({} as AIEvaluationResponse, 200))
	.post("/ai/text-stream", zValidator("json", ChatRequestSchema), (c) => c.text("", 200))
	.get("/profile", (c) => c.json({} as GetProfileResponse, 200))
	.patch("/profile", zValidator("form", UpdateProfileRequestSchema), (c) => c.json({} as UpdateProfileResponse, 200))
	.get("/conversations", (c) => c.json({} as GetConversationsResponse, 200))
	.post("/conversations", zValidator("json", CreateConversationRequestSchema), (c) =>
		c.json({} as CreateConversationResponse, 201),
	)
	.get("/conversations/:id", zValidator("param", routeParamsSchema), (c) => c.json({} as GetConversationResponse, 200))
	.put(
		"/conversations/:id",
		zValidator("param", routeParamsSchema),
		zValidator("json", UpdateConversationRequestSchema),
		(c) => c.json({} as UpdateConversationResponse, 200),
	)
	.get("/embeddings/documents", (c) => c.json({} as EmbeddingDocumentsResponse, 200))
	.delete("/embeddings/documents/:id", zValidator("param", routeParamsSchema), (c) =>
		c.json({} as EmbeddingDeleteResponse, 200),
	)
	.post("/embeddings/ingest", zValidator("json", EmbeddingIngestTextRequestSchema), (c) =>
		c.json({} as EmbeddingIngestResponse, 201),
	)
	.post("/embeddings/upload", zValidator("form", EmbeddingUploadRequestSchema), (c) =>
		c.json({} as EmbeddingIngestResponse, 201),
	)
	.post("/embeddings/search", zValidator("json", EmbeddingSearchRequestSchema), (c) =>
		c.json({} as EmbeddingSearchResponse, 200),
	)
	.post("/embeddings/rag", zValidator("json", RagRequestSchema), (c) => c.json({} as RagResponse, 200));

export type ApiContract = typeof apiContract;
