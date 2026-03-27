import type { z } from "@hono/zod-openapi";

export { models } from "@chat-app/shared/models";

import type {
  LoginResponseSchema,
  LoginUserRequestSchema,
  MeResponseSchema,
  RegisterResponseSchema,
  RegisterUserRequestSchema,
  UserDataSchema,
} from "@chat-app/shared/schemas/auth.schema";
import type {
  CommonErrorResponseSchema,
  ModelSchema,
  ModelsArraySchema,
} from "@chat-app/shared/schemas/common.schema";
import type {
  BasicUserProfileDataSchema,
  GetProfileResponseSchema,
} from "@chat-app/shared/schemas/profile.schema";

export type User = z.infer<typeof UserDataSchema>;
export type RegisterUserRequest = z.infer<typeof RegisterUserRequestSchema>;
export type LoginUserRequest = z.infer<typeof LoginUserRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

export type BasicUserProfile = z.infer<typeof BasicUserProfileDataSchema>;
export type GetProfileResponse = z.infer<typeof GetProfileResponseSchema>;

export type ErrorResponse = z.infer<typeof CommonErrorResponseSchema>;
export type ApiError = ErrorResponse & {
  status?: number;
};

export type Model = z.infer<typeof ModelSchema>;
export type ModelsArray = z.infer<typeof ModelsArraySchema>;
export type AuthResponse = z.infer<typeof MeResponseSchema>;
