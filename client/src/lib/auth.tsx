import type { User } from "@chat-app/shared";
import type { QueryClient } from "@tanstack/react-query";
import { getCurrentUserQuery } from "@/queries/getCurrentUser";

export interface AuthContext {
  isAuthenticated: boolean;
  user: User | null;
  login: (user: User) => void;
  logout: () => void;
}

export function createAuthContext(queryClient: QueryClient): AuthContext {
  const authContext: AuthContext = {
    isAuthenticated: false,
    user: null,
    login: (user: User) => {
      authContext.isAuthenticated = true;
      authContext.user = user;
      queryClient.setQueryData(getCurrentUserQuery().queryKey, user);
    },
    logout: () => {
      authContext.isAuthenticated = false;
      authContext.user = null;
      queryClient.removeQueries({ queryKey: getCurrentUserQuery().queryKey });
    },
  };
  return authContext;
}

export async function loadUser(queryClient: QueryClient, authContext: AuthContext): Promise<User | null> {
  try {
    const user = await queryClient.fetchQuery(getCurrentUserQuery());
    if (user) {
      authContext.login(user);
      return user;
    }
  } catch (_error) {
    authContext.logout();
  }
  return null;
}
