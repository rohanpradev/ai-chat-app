import type {
  ApiError,
  AuthResponse,
  AvailableModelsResponse,
  CreateConversationResponse,
  GetConversationResponse,
  GetConversationsResponse,
  GetProfileResponse,
  LoginResponse,
  RegisterResponse,
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
    },
    auth: {
      login: async (
        payload: InferRequestType<typeof apiClient.auth.login.$post>["json"],
      ): Promise<LoginResponse["data"]> => {
        const response = await apiClient.auth.login.$post({ json: payload });
        const result = await parseResponse<LoginResponse>(response);
        return result.data;
      },
      logout: async (): Promise<void> => {
        const response = await apiClient.auth.logout.$post();
        await parseResponse<{ message: string }>(response);
      },
      me: async (): Promise<AuthResponse["data"]> => {
        const response = await apiClient.auth.me.$get();
        const result = await parseResponse<AuthResponse>(response);
        return result.data;
      },
      register: async (
        payload: InferRequestType<typeof apiClient.auth.register.$post>["json"],
      ): Promise<RegisterResponse["data"]> => {
        const response = await apiClient.auth.register.$post({ json: payload });
        const result = await parseResponse<RegisterResponse>(response);
        return result.data;
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
