import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, Mail, Shield, User, Edit } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AvatarUpload } from "@/components/ui/avatar-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { profileQuery } from "@/lib/queries";
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
  },
  component: ProfileComponent,
});

function ProfileComponent() {
  const { auth } = Route.useRouteContext();
  const profileData = auth.user;
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profileData?.name || "");
  const [profileImage, setProfileImage] = useState(profileData?.profileImage);

  const handleSave = () => {
    // TODO: Implement profile update API call
    console.log("Saving profile:", { name, profileImage });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setName(profileData?.name || "");
    setProfileImage(profileData?.profileImage);
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to={IndexRoute.to}
            className="inline-flex items-center mb-6 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Chat
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile</h1>
          <p className="text-gray-600">Manage your account information and preferences</p>
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
                      value={profileImage}
                      onChange={setProfileImage}
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
                        <Input
                          id="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-48"
                        />
                      </div>
                    ) : (
                      <>
                        <h3 className="text-xl font-semibold text-gray-900">{profileData?.name}</h3>
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
                      <Button onClick={handleSave} size="sm">
                        Save
                      </Button>
                      <Button onClick={handleCancel} variant="outline" size="sm">
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
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">{profileData?.email}</span>
                </div>

                <div className="flex items-center space-x-3">
                  <Shield className="w-4 h-4 text-gray-500" />
                  <span className="text-gray-700">Account Verified</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle>Account Statistics</CardTitle>
              <CardDescription>Your activity overview</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Profile Completion</span>
                  <Badge variant="outline">100%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Security Level</span>
                  <Badge className="bg-green-100 text-green-800">High</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Account Status</span>
                  <Badge className="bg-blue-100 text-blue-800">Active</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
