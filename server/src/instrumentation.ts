// Keep first: compile server-side Zod schemas lazily before application modules load.
import "zod/compile";
import pino from "pino";

const logger = pino({ name: "bootstrap" });

const { OpenTelemetry } = await import("@ai-sdk/otel");
const { registerTelemetry } = await import("ai");
const { initializeTelemetry, isLangfuseTelemetryEnabled } = await import("@/lib/instrumentation");

initializeTelemetry();

if (isLangfuseTelemetryEnabled) {
	registerTelemetry(new OpenTelemetry());
	logger.info("AI SDK OpenTelemetry integration registered");
} else {
	logger.info("AI SDK OpenTelemetry integration disabled: Langfuse credentials not configured");
}
