import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiRequestError } from "@/composables/useApi";
import { authClient } from "@/lib/auth-client";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";
import { AUTH_QUERY_KEY } from "@/utils/query-key";

export const useUserLogout = () => {
  const { auth } = useRouteContext({ strict: false });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const completeLocalLogout = async () => {
    auth?.logout();
    queryClient.clear();
    await navigate({ to: LoginRoute.to, search: { redirect: undefined } });
  };

  return useMutation({
    mutationKey: AUTH_QUERY_KEY.logout,
    mutationFn: async () => {
      const { error } = await authClient.signOut();

      if (error) {
        throw new ApiRequestError({
          details: error,
          message: error.message || "Logout failed.",
          status: error.status || 400,
        });
      }
    },
    onSuccess: async () => {
      await completeLocalLogout();
      toast.success("Successfully logged out.");
    },
    onError: async () => {
      await completeLocalLogout();
      toast.error("Logged out locally.");
    },
  });
};
