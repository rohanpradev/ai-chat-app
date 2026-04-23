export interface Message {
	createdAt?: string;
	id: string;
	metadata?: unknown;
	role: string;
	parts: unknown[];
	schemaVersion?: number;
}

export interface ConversationSummary {
	id: string;
	title: string | null;
	createdAt: string;
	updatedAt: string | null;
}

export interface ConversationDetail extends ConversationSummary {
	messages: Message[];
}

export interface GetConversationsResponse {
	data: ConversationSummary[];
	message: string;
}

export interface GetConversationResponse {
	data: ConversationDetail | null;
	message: string;
}

export interface CreateConversationRequest {
	title?: string;
}

export interface UpdateConversationResponse {
	success: boolean;
	message: string;
}
