import { initializeSentry } from "@/lib/sentry";

initializeSentry();

const { OpenTelemetry } = await import("@ai-sdk/otel");
const { registerTelemetry } = await import("ai");
const { initializeTelemetry, isTelemetryEnabled } = await import("@/lib/instrumentation");

if (isTelemetryEnabled) {
	registerTelemetry(new OpenTelemetry());
}

initializeTelemetry();
