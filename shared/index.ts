// Export all schemas (includes both Zod schemas and inferred types)
export * from "./schemas/index.js";

// Export specific types from types.ts
export type {
	ApiError,
	AuthError,
	AuthResponse,
	BasicUserProfile,
	LoginUserRequest,
	Model,
	ModelsArray,
	RegisterUserRequest,
	User,
} from "./types";

// Export models constant
export { models } from "./types";

// Export UI message types and tools
export { type MyMetadata, type MyTools, type MyUIMessage, tools } from "./types/ui-message.types.js";
