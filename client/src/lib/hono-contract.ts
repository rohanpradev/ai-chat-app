import type {
  AuthResponse,
  CreateConversationRequest,
  CreateConversationResponse,
  GetConversationResponse,
  GetConversationsResponse,
  GetProfileResponse,
  LoginResponse,
  LoginUserRequest,
  RegisterResponse,
  RegisterUserRequest,
} from "@chat-app/shared";
import { Hono } from "hono";

type LogoutResponse = { message: string };

export const apiContract = new Hono()
  .post<"/auth/register", { in: { json: RegisterUserRequest } }>("/auth/register", (c) =>
    c.json({} as RegisterResponse, 201),
  )
  .post<"/auth/login", { in: { json: LoginUserRequest } }>("/auth/login", (c) => c.json({} as LoginResponse, 200))
  .post("/auth/logout", (c) => c.json({} as LogoutResponse, 200))
  .get("/auth/me", (c) => c.json({} as AuthResponse, 200))
  .get("/profile", (c) => c.json({} as GetProfileResponse, 200))
  .get("/conversations", (c) => c.json({} as GetConversationsResponse, 200))
  .post<"/conversations", { in: { json: CreateConversationRequest } }>("/conversations", (c) =>
    c.json({} as CreateConversationResponse, 201),
  )
  .get<"/conversations/:id", { in: { param: { id: string } } }>("/conversations/:id", (c) =>
    c.json({} as GetConversationResponse, 200),
  );

export type ApiContract = typeof apiContract;
