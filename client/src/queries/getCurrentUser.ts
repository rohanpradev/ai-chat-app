import { queryOptions } from "@tanstack/react-query";
import { ApiRequestError } from "@/composables/useApi";
import { authClient, toAppUser } from "@/lib/auth-client";
import { AUTH_QUERY_KEY } from "@/utils/query-key";

export const getCurrentUserQuery = () => {
  return queryOptions({
    queryKey: AUTH_QUERY_KEY.user,
    retry: false,
    queryFn: async () => {
      const { data, error } = await authClient.getSession();

      if (error) {
        throw new ApiRequestError({
          details: error,
          message: error.message || "Please log in to continue.",
          status: error.status || 401,
        });
      }

      if (!data?.user) {
        throw new ApiRequestError({
          message: "Please log in to continue.",
          status: 401,
        });
      }

      return toAppUser(data.user);
    },
  });
};
