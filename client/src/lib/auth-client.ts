import type { User } from "@chat-app/shared";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

type AuthClientUser = {
  email: string;
  id: string;
  image?: string | null;
  name: string;
};

export const toAppUser = (user: AuthClientUser): User => ({
  email: user.email,
  id: user.id,
  name: user.name,
  profileImage: user.image ?? null,
});
