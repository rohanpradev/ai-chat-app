import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Activity, ArrowLeft, Edit, Mail, Shield, User } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { profileQuery } from "@/lib/queries";
import { aiUsageQuery } from "@/queries/getAiUsage";
import { useUpdateProfile } from "@/queries/updateProfile";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";
import { Route as IndexRoute } from "@/routes/index";

export const Route = createFileRoute("/(user)/profile")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: LoginRoute.to, search: { redirect: undefined } });
    }
  },
  loader: async ({ context }) => {
    if (!context.auth.user) {
      await context.queryClient.ensureQueryData(profileQuery());
    }
    await context.queryClient.ensureQueryData(aiUsageQuery());
  },
  component: ProfileComponent,
});

function ProfileComponent() {
  const { auth } = Route.useRouteContext();
  const profileData = auth.user;
  const initialProfileImage = profileData?.profileImage ?? undefined;
  const updateProfile = useUpdateProfile();
  const { data: usage } = useSuspenseQuery(aiUsageQuery());
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profileData?.name || "");
  const [profileImage, setProfileImage] = useState<string | undefined>(initialProfileImage);
  const [profileImageFile, setProfileImageFile] = useState<File | null>(null);

  const handleSave = () => {
    updateProfile.mutate(
      {
        name: name.trim(),
        ...(profileImageFile ? { profileImage: profileImageFile } : {}),
        ...(!profileImage && initialProfileImage && !profileImageFile ? { removeProfileImage: true } : {}),
      },
      {
        onSuccess: (profile) => {
          setName(profile.name);
          setProfileImage(profile.profileImage ?? undefined);
          setProfileImageFile(null);
          setIsEditing(false);
        },
      },
    );
  };

  const handleCancel = () => {
    setName(profileData?.name || "");
    setProfileImage(initialProfileImage);
    setProfileImageFile(null);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-background p-4 text-foreground">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to={IndexRoute.to}
            className="mb-6 inline-flex items-center rounded-lg px-3 py-2 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Link>
          <h1 className="mb-2 text-3xl font-bold">Profile</h1>
          <p className="text-muted-foreground">Manage your account information and data controls</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Personal Information
              </CardTitle>
              <CardDescription>Your basic account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  {isEditing ? (
                    <AvatarUpload
                      disabled={updateProfile.isPending}
                      onChange={setProfileImage}
                      onFileChange={setProfileImageFile}
                      value={profileImage}
                    />
                  ) : (
                    <Avatar className="w-16 h-16">
                      <AvatarImage src={profileImage} alt={profileData?.name} />
                      <AvatarFallback className="bg-blue-100 text-blue-700">
                        <User className="w-8 h-8" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div>
                    {isEditing ? (
                      <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="w-48" />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-semibold">{profileData?.name}</h3>
                        <Badge variant="secondary" className="mt-1">
                          Active User
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex space-x-2">
                  {isEditing ? (
                    <>
                      <Button disabled={!name.trim() || updateProfile.isPending} onClick={handleSave} size="sm">
                        {updateProfile.isPending ? "Saving…" : "Save"}
                      </Button>
                      <Button disabled={updateProfile.isPending} onClick={handleCancel} variant="outline" size="sm">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                      <Edit className="w-4 h-4 mr-2" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{profileData?.email}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Privacy and data
              </CardTitle>
              <CardDescription>Controls that reflect how this account currently works</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>Delete a conversation and all of its stored messages from the chat sidebar.</p>
                <p>Your profile image is optional and can be replaced or removed while editing your profile.</p>
                <p>Model, agent, and web-search choices are controlled per conversation.</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5 text-primary" />
              Usage and quotas
            </CardTitle>
            <CardDescription>
              Daily provider usage resets {new Date(usage.resetsAt).toLocaleString()}. Vector storage remains until you
              delete documents.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <UsageMeter label="AI requests" limit={usage.ai.requests.limit} used={usage.ai.requests.used} />
            <UsageMeter label="AI tokens" limit={usage.ai.tokens.limit} used={usage.ai.tokens.used} />
            <UsageMeter
              label="Embedding tokens"
              limit={usage.embedding.tokens.limit}
              used={usage.embedding.tokens.used}
            />
            <UsageMeter
              label="Vector storage"
              limit={usage.embedding.storageBytes.limit}
              used={usage.embedding.storageBytes.used}
              unit="bytes"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function UsageMeter({
  label,
  limit,
  unit = "count",
  used,
}: Readonly<{ label: string; limit: number; unit?: "bytes" | "count"; used: number }>) {
  const percent = Math.min(100, (used / limit) * 100);
  const format = (value: number) =>
    unit === "bytes"
      ? new Intl.NumberFormat(undefined, {
          notation: "compact",
          style: "unit",
          unit: "byte",
          unitDisplay: "narrow",
        }).format(value)
      : new Intl.NumberFormat(undefined, { notation: "compact" }).format(value);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {format(used)} / {format(limit)}
        </span>
      </div>
      <Progress aria-label={`${label} usage`} value={percent} />
    </div>
  );
}
