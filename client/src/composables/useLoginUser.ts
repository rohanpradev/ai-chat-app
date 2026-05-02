import type { LoginUserRequest } from "@chat-app/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { getApiClient } from "@/composables/useApi";
import { Route as IndexRoute } from "@/routes/index";
import { AUTH_QUERY_KEY } from "@/utils/query-key";

export const useUserLogin = (redirectTo?: string) => {
  const api = getApiClient();
  const { auth } = useRouteContext({ strict: false });
  const navigate = useNavigate();

  return useMutation({
    mutationKey: AUTH_QUERY_KEY.login,
    mutationFn: (payload: LoginUserRequest) => api.auth.login(payload),
    onSuccess: async (data) => {
      auth?.login({ data, message: "Login successful" });
      // Navigate to the intended destination or default to index
      toast.success("Welcome back!");
      await navigate({ to: redirectTo || IndexRoute.to });
    },
  });
};
