import { describe, expect, it } from "bun:test";
import { buildAiTelemetrySettings, isAiTelemetryEnabled } from "@/lib/instrumentation";

describe("AI telemetry settings", () => {
	it("uses the stable AI SDK telemetry API without recording private content", () => {
		expect(buildAiTelemetrySettings("ai-test-operation")).toEqual({
			functionId: "ai-test-operation",
			isEnabled: isAiTelemetryEnabled,
			recordInputs: false,
			recordOutputs: false
		});
	});
});
