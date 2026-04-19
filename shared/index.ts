// Export all schemas (includes both Zod schemas and inferred types)

export {
	type AgentMode,
	type AgentModeDefinition,
	agentModeIds,
	agentModes,
	defaultAgentMode,
	getAgentModeById,
} from "@chat-app/shared/agents";
export {
	type AIModelDefinition,
	type AIModelId,
	type AIProvider,
	defaultModelId,
	getModelById,
	getModelsByProvider,
	modelCatalog,
	modelIds,
	models,
	providers,
} from "@chat-app/shared/models";
export * from "@chat-app/shared/schemas";
export {
	type EnabledRequestToolId,
	type SerperToolInput,
	enabledRequestToolIds,
	deepSearchInputSchema,
	serperInputSchema,
	type SerperToolOutput,
	serperOutputSchema,
	uiMessageToolDefinitions,
	uiMessageTools,
	webSearchToolId,
} from "@chat-app/shared/tools";
export type { ConversationSummary as Chat } from "@chat-app/shared/types/conversation.types";
export type {
	ApiError,
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
} from "@chat-app/shared/types/index";
export {
	type MyMetadata,
	type MyTools,
	type MyUIMessage,
	type SerperUITool,
	safeValidateMyUIMessages,
	tools,
	validateMyUIMessages,
} from "@chat-app/shared/types/ui-message.types";
