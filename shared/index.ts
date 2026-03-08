// Export all schemas (includes both Zod schemas and inferred types)

export {
	type AIModelDefinition,
	type AIModelId,
	type AIProvider,
	getModelById,
	getModelsByProvider,
	modelCatalog,
	modelIds,
	models,
	providers,
} from "./models.js";
export * from "./schemas/index.js";
// Export specific types from types.ts
export type {
	ApiError,
	AuthError,
	AuthResponse,
	BasicUserProfile,
	GetProfileResponse,
	LoginResponse,
	LoginUserRequest,
	Model,
	ModelsArray,
	RegisterResponse,
	RegisterUserRequest,
	User,
} from "./types";
export type { ConversationSummary as Chat } from "./types/conversation.types";

// Export UI message types and tools
export {
	type MyMetadata,
	type MyTools,
	type MyUIMessage,
	safeValidateMyUIMessages,
	tools,
	validateMyUIMessages,
} from "./types/ui-message.types.js";
