import type { GetProfileResponse } from "@chat-app/shared";
import { queryOptions } from "@tanstack/react-query";
import { useApi } from "@/composables/useApi";
import { PROFILE_QUERY_KEY } from "@/utils/query-key";

export const getProfileQuery = () => {
  const { callApi } = useApi();
  return queryOptions<GetProfileResponse>({
    queryKey: PROFILE_QUERY_KEY.userProfile,
    queryFn: () =>
      callApi("profile", {
        method: "GET",
      }),
  });
};
