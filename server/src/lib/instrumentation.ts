/**
 * OpenTelemetry instrumentation for Langfuse observability
 * This module sets up distributed tracing for AI SDK operations
 *
 * @see https://langfuse.com/docs/integrations/vercel-ai-sdk
 */

import env from "@/utils/env";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseExporter } from "langfuse-vercel";

let sdk: NodeSDK | null = null;

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
		console.log("[Langfuse] Skipping initialization - credentials not configured");
		return null;
	}

	console.log("[Langfuse] Initializing telemetry...");

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

		console.log("[Langfuse] Telemetry initialized successfully");

		process.on("SIGTERM", async () => {
			try {
				await sdk?.shutdown();
				console.log("[Langfuse] SDK shut down successfully");
			} catch (error) {
				console.error("[Langfuse] Error shutting down SDK:", error);
			}
		});

		return sdk;
	} catch (error) {
		console.error("[Langfuse] Failed to initialize telemetry:", error);
		return null;
	}
}
