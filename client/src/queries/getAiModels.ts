import { queryOptions } from "@tanstack/react-query";
import { getApiClient } from "@/composables/useApi";
import { AI_QUERY_KEY } from "@/utils/query-key";

export const getAiModelsQuery = () => {
  const api = getApiClient();

  return queryOptions({
    gcTime: 30 * 60 * 1000,
    queryFn: () => api.ai.models(),
    queryKey: AI_QUERY_KEY.models,
    retry: 1,
    staleTime: 5 * 60 * 1000,
  });
};
