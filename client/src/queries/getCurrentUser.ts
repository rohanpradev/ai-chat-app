import { queryOptions } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";
import { AUTH_QUERY_KEY } from "@/utils/query-key";

export const getCurrentUserQuery = () => {
  const api = useApi();
  return queryOptions({
    queryKey: AUTH_QUERY_KEY.user,
    retry: false,
    queryFn: () => api.auth.me(),
  });
};
