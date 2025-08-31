// Export all schemas
export * from "./schemas";

// Export specific types to avoid conflicts
export type {
	ApiError,
	AuthError,
	AuthResponse,
	BasicUserProfile,
	LoginUserRequest,
	RegisterUserRequest,
	User,
	UserProfile,
} from "./types";

export * from "./types/api.types";
export { type MyMetadata, type MyTools, type MyUIMessage, tools } from "./types/ui-message.types";
