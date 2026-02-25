/**
 * OpenTelemetry instrumentation for Langfuse observability
 * This module sets up distributed tracing for AI SDK operations
 *
 * @see https://langfuse.com/docs/integrations/vercel-ai-sdk
 */

import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseExporter } from "langfuse-vercel";
import pino from "pino";
import env from "@/utils/env";

let sdk: NodeSDK | null = null;
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

	const isLangfuseConfigured = env.LANGFUSE_SECRET_KEY && env.LANGFUSE_PUBLIC_KEY;

	if (!isLangfuseConfigured) {
		logger.info("Skipping initialization: Langfuse credentials not configured");
		return null;
	}

	logger.info("Initializing telemetry");

	try {
		const langfuseExporter = new LangfuseExporter({
			baseUrl: env.LANGFUSE_BASEURL,
			publicKey: env.LANGFUSE_PUBLIC_KEY,
			secretKey: env.LANGFUSE_SECRET_KEY
		});

		sdk = new NodeSDK({
			instrumentations: [getNodeAutoInstrumentations()],
			traceExporter: langfuseExporter
		});

		sdk.start();

		logger.info("Telemetry initialized successfully");

		process.on("SIGTERM", async () => {
			try {
				await sdk?.shutdown();
				logger.info("SDK shut down successfully");
			} catch (error) {
				logger.error({ error }, "Error shutting down SDK");
			}
		});

		return sdk;
	} catch (error) {
		logger.error({ error }, "Failed to initialize telemetry");
		return null;
	}
}
