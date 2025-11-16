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

import type { CommonErrorResponseSchema, ModelSchema, ModelsArraySchema } from "./schemas/common.schema";

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

// Model Types
export type Model = z.infer<typeof ModelSchema>;
export type ModelsArray = z.infer<typeof ModelsArraySchema>;

// Available models
export const models: Model[] = [
	{ id: "gpt-4.1-mini", name: "GPT-4.1 Mini", provider: "azure" },
	{ id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "azure" },
	{ id: "gpt-4", name: "GPT-4", provider: "azure" },
	{ id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", provider: "azure" },
	{ id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" },
];

// Auth-related composite types
export type AuthResponse = z.infer<typeof MeResponseSchema>;
export type AuthError = ApiError;
