import type { z } from "@hono/zod-openapi";

// Import only used schemas
import type {
	LoginResponseSchema,
	LoginUserRequestSchema,
	MeResponseSchema,
	RegisterResponseSchema,
	RegisterUserRequestSchema,
	UserDataSchema,
} from "./schemas/auth.schema";

import type { CommonErrorResponseSchema } from "./schemas/common.schema";

import type { BasicUserProfileDataSchema, GetProfileResponseSchema } from "./schemas/profile.schema";

// Auth Types - Only used types
export type User = z.infer<typeof UserDataSchema>;
export type RegisterUserRequest = z.infer<typeof RegisterUserRequestSchema>;
export type LoginUserRequest = z.infer<typeof LoginUserRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// Profile Types - Only used types
export type BasicUserProfile = z.infer<typeof BasicUserProfileDataSchema>;
export type GetProfileResponse = z.infer<typeof GetProfileResponseSchema>;

// Common Types - Only used types
export type ErrorResponse = z.infer<typeof CommonErrorResponseSchema>;
export type ApiError = ErrorResponse & {
	status?: number;
};

// Auth-related composite types
export type AuthResponse = z.infer<typeof MeResponseSchema>;
export type AuthError = ApiError;
