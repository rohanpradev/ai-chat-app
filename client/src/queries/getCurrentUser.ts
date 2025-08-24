import type { MeResponse } from "@chat-app/shared";
import { queryOptions } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";
import { AUTH_QUERY_KEY } from "@/utils/query-key";

export const getCurrentUserQuery = () => {
  const { callApi } = useApi();
  return queryOptions<MeResponse>({
    queryKey: AUTH_QUERY_KEY.user,
    retry: false,
    queryFn: () =>
      callApi("auth/me", {
        method: "GET",
      }),
  });
};
