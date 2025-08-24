import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useActionState, useId } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserRegister } from "@/composables/useRegisterUser";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";
import { Route as IndexRoute } from "@/routes/index";
import { EMAIL_REGEX } from "@/utils";

export const Route = createFileRoute("/(auth)/_auth/register")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: IndexRoute.to });
    }
  },
  component: RegisterForm,
});

interface RegisterState {
  error?: string;
  success?: boolean;
}

function RegisterForm() {
  const { mutateAsync } = useUserRegister();
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const registerAction = async (_prevState: RegisterState, formData: FormData): Promise<RegisterState> => {
    const name = String(formData.get("name") || "");
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!name?.trim()) {
      toast.error("Please enter your name");
      return { error: "Name is required" };
    }
    if (!email?.trim()) {
      toast.error("Please enter your email");
      return { error: "Email is required" };
    }
    if (!EMAIL_REGEX.test(email)) {
      toast.error("Please enter a valid email address");
      return { error: "Invalid email format" };
    }
    if (!password) {
      toast.error("Please enter a password");
      return { error: "Password is required" };
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return { error: "Password too short" };
    }
    if (!confirmPassword) {
      toast.error("Please confirm your password");
      return { error: "Password confirmation is required" };
    }
    if (password !== confirmPassword) {
      toast.error("Passwords don't match");
      return { error: "Passwords don't match" };
    }

    try {
      await mutateAsync({ name: name.trim(), email: email.trim(), password, confirmPassword });
      toast.success("Account created successfully!");
      return { success: true };
    } catch {
      toast.error("Registration failed. Please try again.");
      return { error: "Registration failed" };
    }
  };

  const [_state, formAction, isPending] = useActionState(registerAction, {});

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-blue-600 rounded-xl flex items-center justify-center">
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-label="User registration icon"
            >
              <title>User registration icon</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
        </div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Create your account</h2>
        <p className="mt-2 text-sm text-muted-foreground">Join us and start your AI-powered journey</p>
      </div>

      <Card className="border-0 shadow-xl">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle className="text-xl text-center">Sign up</CardTitle>
          <CardDescription className="text-center">Create your account to get started</CardDescription>
        </CardHeader>

        <CardContent>
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={nameId} className="text-sm font-medium">
                Full Name
              </Label>
              <Input
                id={nameId}
                name="name"
                type="text"
                placeholder="Enter your full name"
                disabled={isPending}
                autoComplete="name"
                required
              />
            </div>

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
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor={passwordId} className="text-sm font-medium">
                Password
              </Label>
              <Input
                id={passwordId}
                name="password"
                type="password"
                placeholder="Create a password (min. 6 characters)"
                disabled={isPending}
                autoComplete="new-password"
                required
              />
              <p className="text-xs text-muted-foreground">Password must be at least 6 characters long</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={confirmPasswordId} className="text-sm font-medium">
                Confirm Password
              </Label>
              <Input
                id={confirmPasswordId}
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                disabled={isPending}
                autoComplete="new-password"
                required
              />
            </div>

            <div className="rounded-md bg-muted p-4">
              <div className="text-xs text-muted-foreground">
                By creating an account, you agree to our Terms of Service and Privacy Policy.
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={isPending}>
              {isPending ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-label="Loading spinner"
                  >
                    <title>Loading spinner</title>
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Creating account...
                </>
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Already have an account?&nbsp;
          <Link to={LoginRoute.to} className="font-medium text-primary hover:text-primary/80 transition-colors">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
