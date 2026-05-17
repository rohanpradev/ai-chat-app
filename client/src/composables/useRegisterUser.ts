import type { RegisterUserRequest } from "@chat-app/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { ApiRequestError } from "@/composables/useApi";
import { authClient, toAppUser } from "@/lib/auth-client";
import { Route as AppRoute } from "@/routes/index";
import { AUTH_QUERY_KEY } from "@/utils/query-key";

export const useUserRegister = () => {
  const { auth } = useRouteContext({ strict: false });
  const navigate = useNavigate();

  return useMutation({
    mutationKey: AUTH_QUERY_KEY.register,
    mutationFn: async (payload: RegisterUserRequest) => {
      const { data, error } = await authClient.signUp.email({
        email: payload.email,
        image: payload.profileImage,
        name: payload.name,
        password: payload.password,
      });

      if (error) {
        throw new ApiRequestError({
          details: error,
          message: error.message || "Registration failed. Please try again.",
          status: error.status || 400,
        });
      }

      if (!data?.user) {
        throw new ApiRequestError({
          message: "Registration failed. Please try again.",
          status: 400,
        });
      }

      return toAppUser(data.user);
    },
    onSuccess: async (data) => {
      auth?.login(data);
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
