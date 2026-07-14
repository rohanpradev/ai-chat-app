import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { getApiClient } from "@/composables/useApi";
import { AUTH_QUERY_KEY, PROFILE_QUERY_KEY } from "@/utils/query-key";

interface UpdateProfileInput {
  name: string;
  profileImage?: File;
  removeProfileImage?: boolean;
}

export const useUpdateProfile = () => {
  const api = getApiClient();
  const queryClient = useQueryClient();
  const { auth } = useRouteContext({ strict: false });

  return useMutation({
    mutationKey: PROFILE_QUERY_KEY.updateUserProfile,
    mutationFn: ({ name, profileImage, removeProfileImage }: UpdateProfileInput) =>
      api.profile.update({
        name,
        ...(profileImage ? { profileImage } : {}),
        ...(removeProfileImage ? { removeProfileImage: "true" as const } : {}),
      }),
    onSuccess: (profile) => {
      queryClient.setQueryData(PROFILE_QUERY_KEY.userProfile, profile);
      queryClient.setQueryData(AUTH_QUERY_KEY.user, profile);
      auth?.login(profile);
      toast.success("Profile updated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Unable to update your profile.");
    },
  });
};
