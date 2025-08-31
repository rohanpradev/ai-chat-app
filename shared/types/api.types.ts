import type { z } from "zod";
import type {
	BadRequestResponseSchema,
	ChatBadRequestResponseSchema,
	ChatErrorResponseSchema,
	CommonBadRequestResponseSchema,
	// Common schemas
	CommonErrorResponseSchema,
	CommonNotFoundResponseSchema,
	CommonUnauthorizedResponseSchema,
	CreateConversationResponseSchema,
	ErrorResponseSchema,
	// Chat schemas
	GetConversationResponseSchema,
	GetConversationsResponseSchema,
	// Profile schemas
	GetProfileResponseSchema,
	// Auth schemas
	LoginResponseSchema,
	LogoutResponseSchema,
	MeResponseSchema,
	ProfileErrorResponseSchema,
	RegisterResponseSchema,
	UnauthorizedResponseSchema,
	UpdateConversationResponseSchema,
	UpdateProfileResponseSchema,
} from "../schemas";

// Auth API Types
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
export type RegisterResponse = z.infer<typeof RegisterResponseSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;

// Chat API Types
export type GetConversationResponse = z.infer<typeof GetConversationResponseSchema>;
export type GetConversationsResponse = z.infer<typeof GetConversationsResponseSchema>;
export type CreateConversationResponse = z.infer<typeof CreateConversationResponseSchema>;
export type UpdateConversationResponse = z.infer<typeof UpdateConversationResponseSchema>;

// Profile API Types
export type GetProfileResponse = z.infer<typeof GetProfileResponseSchema>;
export type UpdateProfileResponse = z.infer<typeof UpdateProfileResponseSchema>;

// Error Response Types (consolidated)
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type UnauthorizedResponse = z.infer<typeof UnauthorizedResponseSchema>;
export type BadRequestResponse = z.infer<typeof BadRequestResponseSchema>;
export type ChatErrorResponse = z.infer<typeof ChatErrorResponseSchema>;
export type ChatBadRequestResponse = z.infer<typeof ChatBadRequestResponseSchema>;
export type ProfileErrorResponse = z.infer<typeof ProfileErrorResponseSchema>;
export type CommonErrorResponse = z.infer<typeof CommonErrorResponseSchema>;
export type CommonBadRequestResponse = z.infer<typeof CommonBadRequestResponseSchema>;
export type CommonUnauthorizedResponse = z.infer<typeof CommonUnauthorizedResponseSchema>;
export type CommonNotFoundResponse = z.infer<typeof CommonNotFoundResponseSchema>;
