import type {
  AIEvaluationRequest,
  AIEvaluationResponse,
  AIPlanRequest,
  AIPlanResponse,
  AvailableModelsResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  EmbeddingDeleteResponse,
  EmbeddingDocumentsResponse,
  EmbeddingIngestResponse,
  EmbeddingIngestTextRequest,
  EmbeddingSearchRequest,
  EmbeddingSearchResponse,
  GetConversationResponse,
  GetConversationsResponse,
  GetProfileResponse,
  RagRequest,
  RagResponse,
} from "@chat-app/shared";
import { Hono } from "hono";

export const apiContract = new Hono()
  .get("/ai/models", (c) => c.json({} as AvailableModelsResponse, 200))
  .post<"/ai/plan", { in: { json: AIPlanRequest } }>("/ai/plan", (c) => c.json({} as AIPlanResponse, 200))
  .post<"/ai/evaluate", { in: { json: AIEvaluationRequest } }>("/ai/evaluate", (c) =>
    c.json({} as AIEvaluationResponse, 200),
  )
  .get("/profile", (c) => c.json({} as GetProfileResponse, 200))
  .get("/conversations", (c) => c.json({} as GetConversationsResponse, 200))
  .post<"/conversations", { in: { json: CreateConversationRequest } }>("/conversations", (c) =>
    c.json({} as CreateConversationResponse, 201),
  )
  .get<"/conversations/:id", { in: { param: { id: string } } }>("/conversations/:id", (c) =>
    c.json({} as GetConversationResponse, 200),
  )
  .get("/embeddings/documents", (c) => c.json({} as EmbeddingDocumentsResponse, 200))
  .delete<"/embeddings/documents/:id", { in: { param: { id: string } } }>("/embeddings/documents/:id", (c) =>
    c.json({} as EmbeddingDeleteResponse, 200),
  )
  .post<"/embeddings/ingest", { in: { json: EmbeddingIngestTextRequest } }>("/embeddings/ingest", (c) =>
    c.json({} as EmbeddingIngestResponse, 201),
  )
  .post<"/embeddings/search", { in: { json: EmbeddingSearchRequest } }>("/embeddings/search", (c) =>
    c.json({} as EmbeddingSearchResponse, 200),
  )
  .post<"/embeddings/rag", { in: { json: RagRequest } }>("/embeddings/rag", (c) => c.json({} as RagResponse, 200));

export type ApiContract = typeof apiContract;
