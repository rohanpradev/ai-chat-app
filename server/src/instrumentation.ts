import pino from "pino";
import { initializeSentry } from "@/lib/sentry";

const logger = pino({ name: "bootstrap" });

initializeSentry();

const { OpenTelemetry } = await import("@ai-sdk/otel");
const { registerTelemetry } = await import("ai");
const { initializeTelemetry, isTelemetryEnabled } = await import("@/lib/instrumentation");

initializeTelemetry();

if (isTelemetryEnabled) {
	registerTelemetry(new OpenTelemetry());
	logger.info("AI SDK OpenTelemetry integration registered");
} else {
	logger.info("AI SDK OpenTelemetry integration disabled: Langfuse credentials not configured");
}
