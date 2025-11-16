import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, Shield } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserLogin } from "@/composables/useLoginUser";
import { Route as RegisterRoute } from "@/routes/(auth)/_auth/register";
import { Route as IndexRoute } from "@/routes/index";

export const Route = createFileRoute("/(auth)/_auth/login")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
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
const MAX_LOGIN_ATTEMPTS = 5;

function LoginComponent() {
  const search = Route.useSearch();
  const { mutateAsync } = useUserLogin(search.redirect);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const emailId = useId();
  const passwordId = useId();

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
    } else if (password.length < 6) {
      fieldErrors.password = "Password must be at least 6 characters";
    }

    if (Object.keys(fieldErrors).length > 0) {
      const firstError = Object.values(fieldErrors)[0];
      toast.error(firstError);
      return { error: "Validation failed", fieldErrors };
    }

    try {
      await mutateAsync({ email: email.trim(), password });
      setLoginAttempts(0);
      toast.success("Welcome back!");
      return { success: true };
    } catch (error: unknown) {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        toast.error(`Too many failed attempts. Account locked for 15 minutes.`);
        return { error: "Account locked due to multiple failed attempts" };
      }

      const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
      const errorMessage =
        error instanceof Error && error.message?.includes("credentials")
          ? `Invalid email or password. ${remainingAttempts} attempts remaining.`
          : "Login failed. Please try again.";

      toast.error(errorMessage);
      return { error: "Login failed" };
    }
  };

  const [state, formAction, isPending] = useActionState(loginAction, {});

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h2>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to your account to continue</p>
      </div>

      <Card className="border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl text-center">Sign in</CardTitle>
          <CardDescription className="text-center">Enter your credentials to access your account</CardDescription>
        </CardHeader>

        <CardContent>
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
                className={`transition-colors ${
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
                  className={`pr-10 transition-colors ${
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
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {state?.fieldErrors?.password && <p className="text-sm text-red-600">{state.fieldErrors.password}</p>}
            </div>

            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
