import type { LoginResponse, LoginUserRequest } from "@chat-app/shared";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { toast } from "sonner";
import { useApi } from "@/composables/useApi";
import { Route as IndexRoute } from "@/routes/index";

export const useUserLogin = () => {
  const { callApi } = useApi();
  const { auth } = useRouteContext({ strict: false });
  const navigate = useNavigate();

  return useMutation<LoginResponse, Error, LoginUserRequest>({
    mutationFn: (payload: LoginUserRequest) =>
      callApi<LoginResponse>("auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        credentials: "include",
      }),
    onSuccess: (data) => {
      auth?.login(data);
      navigate({ to: IndexRoute.to });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "An error occurred during login.");
    },
  });
};
