interface ApiErrorResponse {
  message: string;
  status?: number;
  details?: unknown;
}

interface ApiResponse<T> {
  data: T;
  message: string;
}

export const useApi = () => {
  // Overload for extractData = true (default)
  function callApi<T extends ApiResponse<any>>(
    endpoint: string,
    options?: RequestInit,
    extractData?: true,
  ): Promise<T["data"]>;

  // Overload for extractData = false
  function callApi<T>(endpoint: string, options: RequestInit, extractData: false): Promise<T>;

  // Implementation
  async function callApi<_T>(endpoint: string, options: RequestInit = {}, extractData = true): Promise<any> {
    const response = await fetch(`/api/${endpoint}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      let errorData: ApiErrorResponse;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          message: getStatusMessage(response.status),
          status: response.status,
        };
      }

      const error = new Error(errorData.message) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    const result = await response.json();
    return extractData ? result.data : result;
  }

  return { callApi };
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
