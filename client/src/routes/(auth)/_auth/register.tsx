import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Eye, EyeOff, Loader2, UserPlus } from "lucide-react";
import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { AvatarUpload } from "@/components/ui/avatar-upload";
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
  fieldErrors?: {
    confirmPassword?: string;
    email?: string;
    name?: string;
    password?: string;
  };
  values?: {
    email?: string;
    name?: string;
  };
}

const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 30;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 100;

function RegisterForm() {
  const { mutateAsync } = useUserRegister();
  const [profileImage, setProfileImage] = useState<string | undefined>(undefined);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const nameId = useId();
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();

  const registerAction = async (_prevState: RegisterState, formData: FormData): Promise<RegisterState> => {
    const name = ((formData.get("name") as string | null) ?? "").trim();
    const email = ((formData.get("email") as string | null) ?? "").trim().toLowerCase();
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;
    const fieldErrors: RegisterState["fieldErrors"] = {};
    const values = { email, name };

    if (!name) {
      fieldErrors.name = "Full name is required";
    } else if (name.length < MIN_NAME_LENGTH) {
      fieldErrors.name = `Full name must be at least ${MIN_NAME_LENGTH} characters`;
    } else if (name.length > MAX_NAME_LENGTH) {
      fieldErrors.name = `Full name must be ${MAX_NAME_LENGTH} characters or less`;
    }

    if (!email) {
      fieldErrors.email = "Email is required";
    } else if (!EMAIL_REGEX.test(email)) {
      fieldErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      fieldErrors.password = "Password is required";
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      fieldErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
    } else if (password.length > MAX_PASSWORD_LENGTH) {
      fieldErrors.password = `Password must be ${MAX_PASSWORD_LENGTH} characters or less`;
    }

    if (!confirmPassword) {
      fieldErrors.confirmPassword = "Please confirm your password";
    } else if (password && password !== confirmPassword) {
      fieldErrors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(fieldErrors).length > 0) {
      const firstError = Object.values(fieldErrors)[0];
      toast.error(firstError);
      return { error: "Validation failed", fieldErrors, values };
    }

    try {
      await mutateAsync({
        name,
        email,
        password,
        confirmPassword,
        profileImage,
      });
      return { success: true };
    } catch (error) {
      console.error("Registration error:", error);
      const errorMessage = error instanceof Error ? error.message : "Registration failed. Please try again.";
      return { error: errorMessage, values };
    }
  };

  const [state, formAction, isPending] = useActionState(registerAction, {});

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-blue-600 rounded-xl flex items-center justify-center">
            <UserPlus className="w-6 h-6 text-white" />
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
              <Label className="text-sm font-medium">Profile Picture (Optional)</Label>
              <AvatarUpload value={profileImage} onChange={setProfileImage} disabled={isPending} />
            </div>

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
                className={`transition-colors ${
                  state?.fieldErrors?.name ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
                }`}
                autoComplete="name"
                defaultValue={state?.values?.name}
                aria-invalid={Boolean(state?.fieldErrors?.name)}
                required
              />
              {state?.fieldErrors?.name && <p className="text-sm text-red-600">{state.fieldErrors.name}</p>}
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
                className={`transition-colors ${
                  state?.fieldErrors?.email ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
                }`}
                autoComplete="email"
                defaultValue={state?.values?.email}
                aria-invalid={Boolean(state?.fieldErrors?.email)}
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
                  placeholder="Create a password"
                  disabled={isPending}
                  className={`pr-10 transition-colors ${
                    state?.fieldErrors?.password ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
                  }`}
                  autoComplete="new-password"
                  aria-invalid={Boolean(state?.fieldErrors?.password)}
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
              {state?.fieldErrors?.password ? (
                <p className="text-sm text-red-600">{state.fieldErrors.password}</p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Use {MIN_PASSWORD_LENGTH}-{MAX_PASSWORD_LENGTH} characters.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor={confirmPasswordId} className="text-sm font-medium">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id={confirmPasswordId}
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Confirm your password"
                  disabled={isPending}
                  className={`pr-10 transition-colors ${
                    state?.fieldErrors?.confirmPassword ? "border-red-500 focus:border-red-500 focus:ring-red-500" : ""
                  }`}
                  autoComplete="new-password"
                  aria-invalid={Boolean(state?.fieldErrors?.confirmPassword)}
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isPending}
                  aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {state?.fieldErrors?.confirmPassword && (
                <p className="text-sm text-red-600">{state.fieldErrors.confirmPassword}</p>
              )}
            </div>

            <div className="rounded-md bg-muted p-4">
              <div className="text-xs text-muted-foreground">
                By creating an account, you agree to our Terms of Service and Privacy Policy.
              </div>
            </div>

            <Button type="submit" className="w-full h-11 text-base font-medium" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
          <Link
            to={LoginRoute.to}
            search={{ redirect: undefined }}
            className="font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  );
}
