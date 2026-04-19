import { OpenTelemetry } from "@ai-sdk/otel";
import { registerTelemetry } from "ai";
import { initializeTelemetry, isTelemetryEnabled } from "@/lib/instrumentation";

if (isTelemetryEnabled) {
	registerTelemetry(new OpenTelemetry());
}

initializeTelemetry();
