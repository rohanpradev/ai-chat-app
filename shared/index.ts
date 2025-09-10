// Export all schemas
export * from "./schemas/index.js";

// Export specific types to avoid conflicts with schemas
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

// Export conversation types specifically to avoid conflicts
export type {
	ConversationDetail,
	ConversationSummary,
	CreateConversationRequest,
	Message,
} from "./types/conversation.types.js";

export { type MyMetadata, type MyTools, type MyUIMessage, tools } from "./types/ui-message.types.js";
