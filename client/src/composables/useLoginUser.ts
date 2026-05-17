import type { LoginUserRequest } from "@chat-app/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiRequestError } from "@/composables/useApi";
import { authClient, toAppUser } from "@/lib/auth-client";
import { Route as IndexRoute } from "@/routes/index";
import { AUTH_QUERY_KEY } from "@/utils/query-key";

export const useUserLogin = (redirectTo?: string) => {
  const { auth } = useRouteContext({ strict: false });
  const navigate = useNavigate();

  return useMutation({
    mutationKey: AUTH_QUERY_KEY.login,
    mutationFn: async (payload: LoginUserRequest) => {
      const { data, error } = await authClient.signIn.email({
        email: payload.email,
        password: payload.password,
        rememberMe: true,
      });

      if (error) {
        throw new ApiRequestError({
          details: error,
          message: error.message || "Invalid email or password.",
          status: error.status || 401,
        });
      }

      if (!data?.user) {
        throw new ApiRequestError({
          message: "Login failed. Please try again.",
          status: 401,
        });
      }

      return toAppUser(data.user);
    },
    onSuccess: async (data) => {
      auth?.login(data);
      // Navigate to the intended destination or default to index
      toast.success("Welcome back!");
      await navigate({ to: redirectTo || IndexRoute.to });
    },
  });
};
