import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";

import { BrandMark } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GitHub } from "@/components/ui/github-icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ApiRequestError } from "@/composables/useApi";
import { useUserLogin } from "@/composables/useLoginUser";
import { authClient } from "@/lib/auth-client";
import { redirectSearchValidator } from "@/lib/router-search";
import { Route as RegisterRoute } from "@/routes/(auth)/_auth/register";
import { Route as IndexRoute } from "@/routes/index";

export const Route = createFileRoute("/(auth)/_auth/login")({
  validateSearch: redirectSearchValidator,
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      const redirectTo = search.redirect || IndexRoute.to;
      throw redirect({ to: redirectTo });
    }
  },
  component: LoginComponent,
});

interface LoginState {
  error?: string;
  success?: boolean;
  fieldErrors?: {
    email?: string;
    password?: string;
  };
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
function LoginComponent() {
  const search = Route.useSearch();
  const { mutateAsync } = useUserLogin(search.redirect);
  const [showPassword, setShowPassword] = useState(false);
  const [isGithubPending, setIsGithubPending] = useState(false);
  const emailId = useId();
  const passwordId = useId();

  const signInWithGithub = async () => {
    setIsGithubPending(true);
    const { error } = await authClient.signIn.social({
      callbackURL: search.redirect || IndexRoute.to,
      errorCallbackURL: Route.to,
      provider: "github",
    });

    if (error) {
      setIsGithubPending(false);
      toast.error(error.message || "GitHub sign in failed.");
    }
  };

  const loginAction = async (_prevState: LoginState, formData: FormData): Promise<LoginState> => {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const fieldErrors: LoginState["fieldErrors"] = {};

    if (!email?.trim()) {
      fieldErrors.email = "Email is required";
    } else if (!EMAIL_REGEX.test(email)) {
      fieldErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      fieldErrors.password = "Password is required";
    }

    if (Object.keys(fieldErrors).length > 0) {
      const firstError = Object.values(fieldErrors)[0];
      toast.error(firstError);
      return { error: "Validation failed", fieldErrors };
    }

    try {
      await mutateAsync({ email: email.trim(), password });
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof ApiRequestError && error.status === 429
          ? "Too many sign-in attempts. Please wait a moment and try again."
          : error instanceof Error && error.message?.includes("credentials")
            ? "Invalid email or password."
            : "Login failed. Please try again.";

      toast.error(errorMessage);
      return { error: "Login failed" };
    }
  };

  const [state, formAction, isPending] = useActionState(loginAction, {});

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <BrandMark className="size-12 rounded-2xl" label="ChatFlow" />
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to your account to continue</p>
      </div>

      <Card className="rounded-3xl border-border/70 bg-card/90 shadow-2xl shadow-black/5 backdrop-blur dark:shadow-black/20">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl text-center">Sign in</CardTitle>
          <CardDescription className="text-center">Enter your credentials to access your account</CardDescription>
        </CardHeader>

        <CardContent>
          <Button
            type="button"
            variant="outline"
            className="mb-4 h-11 w-full rounded-xl text-base font-medium"
            disabled={isPending || isGithubPending}
            onClick={signInWithGithub}
          >
            {isGithubPending ? <Spinner aria-hidden="true" className="mr-2" /> : <GitHub className="mr-2 h-4 w-4" />}
            Continue with GitHub
          </Button>

          <div className="mb-4 flex items-center gap-3 text-xs uppercase text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>Email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={emailId} className="text-sm font-medium">
                Email address
              </Label>
              <Input
                id={emailId}
                name="email"
                type="email"
                placeholder="Enter your email address"
                disabled={isPending}
                aria-invalid={Boolean(state?.fieldErrors?.email)}
                className={`h-11 rounded-xl transition-colors ${
                  state?.fieldErrors?.email ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
                }`}
                autoComplete="email"
                required
              />
              {state?.fieldErrors?.email && <p className="text-sm text-red-600">{state.fieldErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor={passwordId} className="text-sm font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id={passwordId}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  disabled={isPending}
                  aria-invalid={Boolean(state?.fieldErrors?.password)}
                  className={`h-11 rounded-xl pr-10 transition-colors ${
                    state?.fieldErrors?.password ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
                  }`}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isPending}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {state?.fieldErrors?.password && <p className="text-sm text-red-600">{state.fieldErrors.password}</p>}
            </div>

            <Button
              aria-busy={isPending}
              type="submit"
              className="h-11 w-full rounded-xl text-base font-medium"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Spinner aria-hidden="true" className="mr-2" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Don't have an account?&nbsp;
          <Link to={RegisterRoute.to} className="font-medium text-primary hover:text-primary/80 transition-colors">
            Create one now
          </Link>
        </p>
      </div>
    </div>
  );
}
