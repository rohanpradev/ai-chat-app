// Export all schemas
export * from "./schemas/index.js";

// Export specific types to avoid conflicts
export type {
	ApiError,
	AuthError,
	AuthResponse,
	BasicUserProfile,
	GetProfileResponse,
	LoginResponse,
	LoginUserRequest,
	RegisterResponse,
	RegisterUserRequest,
	User,
} from "./types";

export * from "./types/api.types.js";
export { type MyMetadata, type MyTools, type MyUIMessage, tools } from "./types/ui-message.types.js";
