import type {
  AIEvaluationResponse,
  AIPlanResponse,
  ApiError,
  AvailableModelsResponse,
  CreateConversationResponse,
  EmbeddingDeleteResponse,
  EmbeddingDocumentsResponse,
  EmbeddingIngestResponse,
  EmbeddingSearchResponse,
  GetConversationResponse,
  GetConversationsResponse,
  GetProfileResponse,
  RagResponse,
} from "@chat-app/shared";
import { hc, type InferRequestType } from "hono/client";
import type { ApiContract } from "@/lib/hono-contract";

type ApiErrorPayload = ApiError & {
  details?: unknown;
  status: number;
};

export class ApiRequestError extends Error {
  readonly details?: unknown;
  readonly status: number;

  constructor({ details, message, status }: ApiErrorPayload) {
    super(message);
    this.name = "ApiRequestError";
    this.details = details;
    this.status = status;
  }
}

const apiClient = hc<ApiContract>("/api", {
  init: {
    credentials: "include",
  },
});

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorData: ApiErrorPayload;

    try {
      const parsed = (await response.json()) as Partial<ApiErrorPayload>;
      errorData = {
        details: parsed.details,
        message: parsed.message || getStatusMessage(response.status),
        status: response.status,
      };
    } catch {
      errorData = {
        message: getStatusMessage(response.status),
        status: response.status,
      };
    }

    throw new ApiRequestError(errorData);
  }

  return response.json() as Promise<T>;
}

export const getApiClient = () => {
  return {
    ai: {
      models: async () => {
        const response = await apiClient.ai.models.$get();
        const result = await parseResponse<AvailableModelsResponse>(response);
        return result.data;
      },
      plan: async (payload: InferRequestType<typeof apiClient.ai.plan.$post>["json"]): Promise<AIPlanResponse> => {
        const response = await apiClient.ai.plan.$post({ json: payload });
        return parseResponse<AIPlanResponse>(response);
      },
      evaluate: async (
        payload: InferRequestType<typeof apiClient.ai.evaluate.$post>["json"],
      ): Promise<AIEvaluationResponse> => {
        const response = await apiClient.ai.evaluate.$post({ json: payload });
        return parseResponse<AIEvaluationResponse>(response);
      },
    },
    conversations: {
      create: async (
        payload: InferRequestType<typeof apiClient.conversations.$post>["json"],
      ): Promise<CreateConversationResponse["data"]> => {
        const response = await apiClient.conversations.$post({ json: payload });
        const result = await parseResponse<CreateConversationResponse>(response);
        return result.data;
      },
      get: async (id: string): Promise<GetConversationResponse["data"]> => {
        const response = await apiClient.conversations[":id"].$get({
          param: { id },
        });
        const result = await parseResponse<GetConversationResponse>(response);
        return result.data;
      },
      list: async (): Promise<GetConversationsResponse["data"]> => {
        const response = await apiClient.conversations.$get();
        const result = await parseResponse<GetConversationsResponse>(response);
        return result.data;
      },
    },
    embeddings: {
      delete: async (id: string): Promise<EmbeddingDeleteResponse["data"]> => {
        const response = await apiClient.embeddings.documents[":id"].$delete({
          param: { id },
        });
        const result = await parseResponse<EmbeddingDeleteResponse>(response);
        return result.data;
      },
      ingestText: async (
        payload: InferRequestType<typeof apiClient.embeddings.ingest.$post>["json"],
      ): Promise<EmbeddingIngestResponse["data"]> => {
        const response = await apiClient.embeddings.ingest.$post({ json: payload });
        const result = await parseResponse<EmbeddingIngestResponse>(response);
        return result.data;
      },
      list: async (): Promise<EmbeddingDocumentsResponse["data"]> => {
        const response = await apiClient.embeddings.documents.$get();
        const result = await parseResponse<EmbeddingDocumentsResponse>(response);
        return result.data;
      },
      rag: async (
        payload: InferRequestType<typeof apiClient.embeddings.rag.$post>["json"],
      ): Promise<RagResponse["data"]> => {
        const response = await apiClient.embeddings.rag.$post({ json: payload });
        const result = await parseResponse<RagResponse>(response);
        return result.data;
      },
      search: async (
        payload: InferRequestType<typeof apiClient.embeddings.search.$post>["json"],
      ): Promise<EmbeddingSearchResponse["data"]> => {
        const response = await apiClient.embeddings.search.$post({ json: payload });
        const result = await parseResponse<EmbeddingSearchResponse>(response);
        return result.data;
      },
      upload: async (payload: {
        file: File;
        metadata?: Record<string, unknown>;
        title?: string;
      }): Promise<EmbeddingIngestResponse["data"]> => {
        const formData = new FormData();
        formData.append("file", payload.file);
        if (payload.title) {
          formData.append("title", payload.title);
        }
        if (payload.metadata) {
          formData.append("metadata", JSON.stringify(payload.metadata));
        }

        const response = await fetch("/api/embeddings/upload", {
          body: formData,
          credentials: "include",
          method: "POST",
        });
        const result = await parseResponse<EmbeddingIngestResponse>(response);
        return result.data;
      },
    },
    profile: {
      get: async (): Promise<GetProfileResponse["data"]> => {
        const response = await apiClient.profile.$get();
        const result = await parseResponse<GetProfileResponse>(response);
        return result.data;
      },
    },
  };
};

function getStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return "Invalid request. Please check your input.";
    case 401:
      return "Please log in to continue.";
    case 403:
      return "Access denied.";
    case 404:
      return "Resource not found.";
    case 429:
      return "Too many requests. Please wait a moment.";
    case 500:
      return "Server error. Please try again.";
    case 502:
      return "Service temporarily unavailable.";
    case 503:
      return "Service temporarily unavailable.";
    default:
      return `Request failed with status ${status}.`;
  }
}
