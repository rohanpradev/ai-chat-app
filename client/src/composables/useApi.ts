import type { ApiError } from "@chat-app/shared";
import type { ApiContract } from "@chat-app/shared/api-contract";
import {
  type ClientResponse,
  DetailedError,
  hc,
  type InferRequestType,
  parseResponse as parseHonoResponse,
} from "hono/client";
import type { ResponseFormat } from "hono/types";
import type { StatusCode } from "hono/utils/http-status";

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

export const apiBasePath = "/api" as const;

export const apiClient = hc<ApiContract>(apiBasePath, {
  init: {
    credentials: "include",
  },
});

type ConversationByIdRoute = (typeof apiClient.conversations)[":id"];
type UpdateConversationPayload = InferRequestType<ConversationByIdRoute["$put"]>["json"];

function parseApiResponse<T extends ClientResponse<unknown, StatusCode, ResponseFormat>>(response: T | Promise<T>) {
  return parseHonoResponse(response).catch((error: unknown) => {
    throw normalizeApiError(error);
  });
}

function normalizeApiError(error: unknown): Error {
  if (error instanceof ApiRequestError) {
    return error;
  }

  if (error instanceof DetailedError) {
    const status = typeof error.statusCode === "number" ? error.statusCode : 500;
    const details = error.detail;

    return new ApiRequestError({
      details,
      message: getErrorMessage(details, error.message || getStatusMessage(status)),
      status,
    });
  }

  return error instanceof Error ? error : new Error("Request failed.");
}

function getErrorMessage(details: unknown, fallback: string): string {
  if (details && typeof details === "object" && "message" in details) {
    const message = details.message;
    if (typeof message === "string") {
      return message;
    }
  }

  return fallback;
}

export const getApiClient = () => {
  return {
    ai: {
      models: async () => {
        const result = await parseApiResponse(apiClient.ai.models.$get());
        return result.data;
      },
      plan: async (payload: InferRequestType<typeof apiClient.ai.plan.$post>["json"]) => {
        return parseApiResponse(apiClient.ai.plan.$post({ json: payload }));
      },
      evaluate: async (payload: InferRequestType<typeof apiClient.ai.evaluate.$post>["json"]) => {
        return parseApiResponse(apiClient.ai.evaluate.$post({ json: payload }));
      },
    },
    conversations: {
      create: async (payload: InferRequestType<typeof apiClient.conversations.$post>["json"]) => {
        const result = await parseApiResponse(apiClient.conversations.$post({ json: payload }));
        return result.data;
      },
      get: async (id: string) => {
        const result = await parseApiResponse(
          apiClient.conversations[":id"].$get({
            param: { id },
          }),
        );
        return result.data;
      },
      list: async () => {
        const result = await parseApiResponse(apiClient.conversations.$get());
        return result.data;
      },
      update: async (id: string, payload: UpdateConversationPayload) => {
        const result = await parseApiResponse(
          apiClient.conversations[":id"].$put({
            json: payload,
            param: { id },
          }),
        );
        return result.data;
      },
    },
    embeddings: {
      delete: async (id: string) => {
        const result = await parseApiResponse(
          apiClient.embeddings.documents[":id"].$delete({
            param: { id },
          }),
        );
        return result.data;
      },
      ingestText: async (payload: InferRequestType<typeof apiClient.embeddings.ingest.$post>["json"]) => {
        const result = await parseApiResponse(apiClient.embeddings.ingest.$post({ json: payload }));
        return result.data;
      },
      list: async () => {
        const result = await parseApiResponse(apiClient.embeddings.documents.$get());
        return result.data;
      },
      rag: async (payload: InferRequestType<typeof apiClient.embeddings.rag.$post>["json"]) => {
        const result = await parseApiResponse(apiClient.embeddings.rag.$post({ json: payload }));
        return result.data;
      },
      search: async (payload: InferRequestType<typeof apiClient.embeddings.search.$post>["json"]) => {
        const result = await parseApiResponse(apiClient.embeddings.search.$post({ json: payload }));
        return result.data;
      },
      upload: async (payload: { file: File; metadata?: Record<string, unknown>; title?: string }) => {
        const form: InferRequestType<typeof apiClient.embeddings.upload.$post>["form"] = {
          file: payload.file,
          ...(payload.metadata ? { metadata: JSON.stringify(payload.metadata) } : {}),
          ...(payload.title ? { title: payload.title } : {}),
        };
        const result = await parseApiResponse(apiClient.embeddings.upload.$post({ form }));
        return result.data;
      },
    },
    profile: {
      get: async () => {
        const result = await parseApiResponse(apiClient.profile.$get());
        return result.data;
      },
      update: async (payload: InferRequestType<typeof apiClient.profile.$patch>["form"]) => {
        const result = await parseApiResponse(apiClient.profile.$patch({ form: payload }));
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
