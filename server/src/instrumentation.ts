import { OpenTelemetryIntegration } from "@ai-sdk/otel";
import { registerTelemetryIntegration } from "ai";
import { initializeTelemetry, isTelemetryEnabled } from "@/lib/instrumentation";

if (isTelemetryEnabled) {
	registerTelemetryIntegration(new OpenTelemetryIntegration());
}

initializeTelemetry();
