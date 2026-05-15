import type { LoginResponse, RegisterResponse, User } from "@chat-app/shared";
import type { QueryClient } from "@tanstack/react-query";
import { ApiRequestError } from "@/composables/useApi";
import { captureSentryException, setSentryUser } from "@/lib/sentry";
import { getCurrentUserQuery } from "@/queries/getCurrentUser";

export interface AuthContext {
  isAuthenticated: boolean;
  user: User | null;
  login: (response: LoginResponse | RegisterResponse) => void;
  logout: () => void;
}

export function createAuthContext(queryClient: QueryClient): AuthContext {
  const authContext: AuthContext = {
    isAuthenticated: false,
    user: null,
    login: (response: LoginResponse | RegisterResponse) => {
      authContext.isAuthenticated = true;
      authContext.user = response.data;
      setSentryUser({ id: response.data.id });
      queryClient.setQueryData(getCurrentUserQuery().queryKey, response.data);
    },
    logout: () => {
      authContext.isAuthenticated = false;
      authContext.user = null;
      setSentryUser(null);
      queryClient.removeQueries({ queryKey: getCurrentUserQuery().queryKey });
    },
  };
  return authContext;
}

export async function loadUser(queryClient: QueryClient, authContext: AuthContext): Promise<User | null> {
  try {
    const user = await queryClient.fetchQuery(getCurrentUserQuery());
    if (user) {
      authContext.login({ data: user, message: "User loaded" });
      return user;
    }
  } catch (error) {
    if (error instanceof ApiRequestError && (error.status === 401 || error.status === 403)) {
      authContext.logout();
      return null;
    }

    console.error("Failed to load current user:", error);
    captureSentryException(error);
    authContext.logout();
  }
  return null;
}
