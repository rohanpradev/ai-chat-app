/**
 * OpenTelemetry instrumentation for Langfuse observability
 * This module sets up distributed tracing for AI SDK operations
 *
 * @see https://langfuse.com/docs/integrations/vercel-ai-sdk
 */

import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeSDK } from "@opentelemetry/sdk-node";
import pino from "pino";
import env from "@/utils/env";

let sdk: NodeSDK | null = null;
let shutdownPromise: Promise<void> | null = null;
export const isTelemetryEnabled = Boolean(env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY);

const logger = pino({
	level: env.LOG_LEVEL,
	name: "telemetry"
});

/**
 * Initialize OpenTelemetry with Langfuse exporter
 * Only initializes if Langfuse credentials are configured
 *
 * @returns NodeSDK instance or null if not configured
 */
export function initializeTelemetry(): NodeSDK | null {
	if (sdk) {
		return sdk;
	}

	if (!isTelemetryEnabled) {
		logger.info("Skipping initialization: Langfuse credentials not configured");
		return null;
	}

	logger.info("Initializing telemetry");

	try {
		const langfuseSpanProcessor = new LangfuseSpanProcessor({
			baseUrl: env.LANGFUSE_BASE_URL,
			environment: env.NODE_ENV,
			publicKey: env.LANGFUSE_PUBLIC_KEY,
			secretKey: env.LANGFUSE_SECRET_KEY
		});

		sdk = new NodeSDK({
			spanProcessors: [langfuseSpanProcessor]
		});

		sdk.start();

		logger.info("Telemetry initialized successfully");

		return sdk;
	} catch (error) {
		logger.error({ error }, "Failed to initialize telemetry");
		return null;
	}
}

export function shutdownTelemetry(signal: NodeJS.Signals): Promise<void> {
	if (!sdk) {
		return Promise.resolve();
	}

	shutdownPromise ??= sdk
		.shutdown()
		.then(() => {
			logger.info({ signal }, "Telemetry shut down successfully");
		})
		.catch((error: unknown) => {
			logger.error({ error, signal }, "Failed to shut down telemetry");
		});

	return shutdownPromise;
}
