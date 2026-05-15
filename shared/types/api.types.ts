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
	EmbeddingDeleteResponseSchema,
	EmbeddingDocumentsResponseSchema,
	EmbeddingIngestResponseSchema,
	EmbeddingSearchResponseSchema,
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
	RagResponseSchema,
	RegisterResponseSchema,
	UnauthorizedResponseSchema,
	UpdateConversationResponseSchema,
	UpdateProfileResponseSchema,
} from "@chat-app/shared/schemas";
import type { z } from "zod";

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

// Embedding API Types
export type EmbeddingIngestResponse = z.infer<typeof EmbeddingIngestResponseSchema>;
export type EmbeddingSearchResponse = z.infer<typeof EmbeddingSearchResponseSchema>;
export type EmbeddingDocumentsResponse = z.infer<typeof EmbeddingDocumentsResponseSchema>;
export type EmbeddingDeleteResponse = z.infer<typeof EmbeddingDeleteResponseSchema>;
export type RagResponse = z.infer<typeof RagResponseSchema>;

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
