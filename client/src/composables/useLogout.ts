import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { getApiClient } from "@/composables/useApi";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";
import { AUTH_QUERY_KEY } from "@/utils/query-key";

export const useUserLogout = () => {
  const api = getApiClient();
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
    mutationFn: () => api.auth.logout(),
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
