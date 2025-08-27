import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { useApi } from "@/composables/useApi";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";

export const useUserLogout = () => {
  const { callApi } = useApi();
  const { auth } = useRouteContext({ strict: false });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      callApi("auth/logout", {
        method: "POST",
        credentials: "include",
      }),
    onSuccess: () => {
      auth?.logout();
      queryClient.clear();
      toast.success("Successfully logged out.");
      navigate({ to: LoginRoute.to, search: { redirect: undefined } });
    },
    onError: () => {
      auth?.logout();
      queryClient.clear();
      navigate({ to: LoginRoute.to, search: { redirect: undefined } });
      toast.error("Logged out locally.");
    },
  });
};
