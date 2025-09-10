import type { LanguageModel } from "ai";
import { isLangfuseEnabled } from "@/lib/langfuse";

/**
 * Configuration for Langfuse tracing
 */
export interface LangfuseTraceConfig {
	functionId?: string;
	traceId?: string;
	userId?: string;
	sessionId?: string;
	tags?: string[];
	metadata?: Record<string, unknown>;
	updateParent?: boolean;
}

/**
 * Default telemetry configuration for AI SDK calls
 */
export function createTelemetryConfig(config: LangfuseTraceConfig = {}) {
	if (!isLangfuseEnabled()) {
		return { isEnabled: false };
	}

	return {
		functionId: config.functionId || "ai-generation",
		isEnabled: true,
		metadata: {
			...config.metadata,
			...(config.traceId && { langfuseTraceId: config.traceId }),
			...(config.userId && { userId: config.userId }),
			...(config.sessionId && { sessionId: config.sessionId }),
			...(config.tags && { tags: config.tags }),
			...(config.updateParent !== undefined && { langfuseUpdateParent: config.updateParent })
		}
	};
}

/**
 * Enhanced generateText with automatic Langfuse tracing
 */
export function createTracedGenerateText(generateText: any) {
	return async function tracedGenerateText(options: {
		model: LanguageModel;
		prompt?: string;
		messages?: any[];
		system?: string;
		maxTokens?: number;
		temperature?: number;
		topP?: number;
		topK?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		stopSequences?: string[];
		seed?: number;
		maxRetries?: number;
		abortSignal?: AbortSignal;
		headers?: Record<string, string>;
		experimental_telemetry?: any;
		langfuse?: LangfuseTraceConfig;
	}) {
		const { langfuse, ...generateOptions } = options;

		// Add telemetry configuration
		const telemetryConfig = createTelemetryConfig(langfuse);

		return generateText({
			...generateOptions,
			experimental_telemetry: {
				...options.experimental_telemetry,
				...telemetryConfig
			}
		});
	};
}

/**
 * Enhanced streamText with automatic Langfuse tracing
 */
export function createTracedStreamText(streamText: any) {
	return async function tracedStreamText(options: {
		model: LanguageModel;
		prompt?: string;
		messages?: any[];
		system?: string;
		maxTokens?: number;
		temperature?: number;
		topP?: number;
		topK?: number;
		frequencyPenalty?: number;
		presencePenalty?: number;
		stopSequences?: string[];
		seed?: number;
		maxRetries?: number;
		abortSignal?: AbortSignal;
		headers?: Record<string, string>;
		experimental_telemetry?: any;
		langfuse?: LangfuseTraceConfig;
	}) {
		const { langfuse, ...streamOptions } = options;

		// Add telemetry configuration
		const telemetryConfig = createTelemetryConfig(langfuse);

		return streamText({
			...streamOptions,
			experimental_telemetry: {
				...options.experimental_telemetry,
				...telemetryConfig
			}
		});
	};
}

/**
 * Utility to extract user and session information from request context
 */
export function extractTraceContext(c: any): Partial<LangfuseTraceConfig> {
	const context: Partial<LangfuseTraceConfig> = {};

	// Extract user ID from JWT token if available
	try {
		const user = c.get("user");
		if (user?.id) {
			context.userId = user.id;
		}
	} catch {
		// User not authenticated, skip
	}

	// Extract session ID from headers if available
	const sessionId = c.req.header("x-session-id");
	if (sessionId) {
		context.sessionId = sessionId;
	}

	// Extract trace ID from headers if available
	const traceId = c.req.header("x-trace-id");
	if (traceId) {
		context.traceId = traceId;
	}

	return context;
}
