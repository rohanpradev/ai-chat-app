const API_URL = import.meta.env.VITE_API_URL;

interface ApiErrorResponse {
  message: string;
  status?: number;
  details?: unknown;
}

export const useApi = () => {
  const callApi = async <T>(endpoint: string, options: RequestInit = {}, extractData = true): Promise<T> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

    try {
      const response = await fetch(`${API_URL}/${endpoint}`, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
        signal: controller.signal,
        ...options,
      });

      clearTimeout(timeoutId);

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
      return extractData ? result.data || result : result;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Request timeout. Please try again.");
        }
        if (!navigator.onLine) {
          throw new Error("No internet connection. Please check your network.");
        }
      }

      console.error(`API error [${endpoint}]:`, error);
      throw error;
    }
  };

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
