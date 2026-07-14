import { queryOptions } from "@tanstack/react-query";
import { getApiClient } from "@/composables/useApi";
import { AI_QUERY_KEY } from "@/utils/query-key";

export const aiUsageQuery = () =>
  queryOptions({
    queryFn: () => getApiClient().ai.usage(),
    queryKey: AI_QUERY_KEY.usage,
    staleTime: 30_000,
  });
