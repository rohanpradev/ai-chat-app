import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseExporter } from "langfuse-vercel";
import pino from "pino";
import pretty from "pino-pretty";
import env from "@/utils/env";

let sdk: NodeSDK | null = null;

// Create a dedicated logger for Langfuse operations
const logger = pino(
	{
		level: env.LOG_LEVEL,
		name: "langfuse"
	},
	env.NODE_ENV === "production" ? undefined : pretty()
);

/**
 * Initialize Langfuse OpenTelemetry SDK
 * This should be called once at application startup
 */
export function initializeLangfuse(): NodeSDK {
	if (sdk) {
		logger.info("SDK already initialized");
		return sdk;
	}

	// Only initialize if Langfuse is configured
	if (!env.LANGFUSE_SECRET_KEY || !env.LANGFUSE_PUBLIC_KEY) {
		logger.warn("Credentials not found. Tracing will be disabled.");
		return null as any;
	}

	try {
		sdk = new NodeSDK({
			instrumentations: [
				getNodeAutoInstrumentations({
					// Disable some instrumentations that might be noisy
					"@opentelemetry/instrumentation-fs": {
						enabled: false
					},
					"@opentelemetry/instrumentation-net": {
						enabled: false
					}
				})
			],
			traceExporter: new LangfuseExporter({
				baseUrl: env.LANGFUSE_URL,
				debug: env.NODE_ENV === "development",
				publicKey: env.LANGFUSE_PUBLIC_KEY,
				secretKey: env.LANGFUSE_SECRET_KEY
			})
		});

		sdk.start();
		logger.info("OpenTelemetry SDK initialized successfully");
		return sdk;
	} catch (error) {
		logger.error({ error }, "Failed to initialize SDK");
		return null as any;
	}
}

/**
 * Gracefully shutdown the Langfuse SDK
 * This should be called during application shutdown
 */
export async function shutdownLangfuse(): Promise<void> {
	if (sdk) {
		try {
			await sdk.shutdown();
			logger.info("SDK shutdown completed");
		} catch (error) {
			logger.error({ error }, "Error during SDK shutdown");
		} finally {
			sdk = null;
		}
	}
}

/**
 * Get the current SDK instance
 */
export function getLangfuseSDK(): NodeSDK | null {
	return sdk;
}

/**
 * Check if Langfuse is properly configured and initialized
 */
export function isLangfuseEnabled(): boolean {
	return sdk !== null && !!env.LANGFUSE_SECRET_KEY && !!env.LANGFUSE_PUBLIC_KEY;
}
