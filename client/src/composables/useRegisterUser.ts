import type { RegisterUserRequest } from "@chat-app/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { getApiClient } from "@/composables/useApi";
import { Route as AppRoute } from "@/routes/index";
import { AUTH_QUERY_KEY } from "@/utils/query-key";

export const useUserRegister = () => {
  const api = getApiClient();
  const { auth } = useRouteContext({ strict: false });
  const navigate = useNavigate();

  return useMutation({
    mutationKey: AUTH_QUERY_KEY.register,
    mutationFn: (payload: RegisterUserRequest) => api.auth.register(payload),
    onSuccess: async (data) => {
      auth?.login({ data, message: "Registration successful" });
      toast.success("Successfully registered user.");
      await navigate({ to: AppRoute.fullPath });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message ? error.message : "An unexpected error occurred during registration.",
      );
    },
  });
};
