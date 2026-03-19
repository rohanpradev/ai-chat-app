import { queryOptions } from "@tanstack/react-query";
import { getApiClient } from "@/composables/useApi";
import { PROFILE_QUERY_KEY } from "@/utils/query-key";

export const getProfileQuery = () => {
  const api = getApiClient();
  return queryOptions({
    queryKey: PROFILE_QUERY_KEY.userProfile,
    queryFn: () => api.profile.get(),
  });
};
