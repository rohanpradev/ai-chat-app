import type { RegisterResponse, RegisterUserRequest } from "@chat-app/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { useApi } from "@/composables/useApi";
import { Route as AppRoute } from "@/routes/index";

export const useUserRegister = () => {
  const { callApi } = useApi();
  const { auth } = useRouteContext({ strict: false });
  const navigate = useNavigate();

  return useMutation<RegisterResponse, Error, RegisterUserRequest>({
    mutationFn: (payload: RegisterUserRequest) =>
      callApi("auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
      }),
    onSuccess: (data) => {
      auth?.login(data);
      toast.success("Successfully registered user.");
      navigate({ to: AppRoute.fullPath });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message ? error.message : "An unexpected error occurred during registration.",
      );
    },
  });
};
