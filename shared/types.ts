import type { z } from "@hono/zod-openapi";

// Import all schemas
import type {
	LoginResponseSchema,
	LoginUserRequestSchema,
	LogoutResponseSchema,
	MeResponseSchema,
	RegisterResponseSchema,
	RegisterUserRequestSchema,
	UserDataSchema,
} from "./schemas/auth.schema";

import type {
	CommonBadRequestResponseSchema,
	CommonErrorResponseSchema,
	CommonNotFoundResponseSchema,
	CommonUnauthorizedResponseSchema,
	SuccessMessageResponseSchema,
	ValidationErrorSchema,
} from "./schemas/common.schema";

import type {
	BasicUserProfileDataSchema,
	GetProfileResponseSchema,
	UpdateProfileRequestSchema,
	UpdateProfileResponseSchema,
	UserProfileDataSchema,
} from "./schemas/profile.schema";

// Auth Types
export type User = z.infer<typeof UserDataSchema>;
export type RegisterUserRequest = z.infer<typeof RegisterUserRequestSchema>;
export type LoginUserRequest = z.infer<typeof LoginUserRequestSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;

// Profile Types
export type UserProfile = z.infer<typeof UserProfileDataSchema>;
export type BasicUserProfile = z.infer<typeof BasicUserProfileDataSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type GetProfileResponse = z.infer<typeof GetProfileResponseSchema>;
export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;

// Common Types
export type ErrorResponse = z.infer<typeof CommonErrorResponseSchema>;
export type BadRequestResponse = z.infer<typeof CommonBadRequestResponseSchema>;
export type UnauthorizedResponse = z.infer<typeof CommonUnauthorizedResponseSchema>;
export type NotFoundResponse = z.infer<typeof CommonNotFoundResponseSchema>;
export type SuccessMessageResponse = z.infer<typeof SuccessMessageResponseSchema>;
export type ValidationError = z.infer<typeof ValidationErrorSchema>;

// Enhanced Error Type for client usage
export type ApiError = ErrorResponse & {
	status?: number;
};

// Auth-related composite types
export type AuthResponse = MeResponse;
export type AuthError = ApiError;
