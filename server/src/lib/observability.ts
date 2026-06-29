import { trace } from "@opentelemetry/api";

export const getActiveTraceContext = () => {
	const spanContext = trace.getActiveSpan()?.spanContext();

	if (!spanContext) {
		return undefined;
	}

	return {
		spanId: spanContext.spanId,
		traceFlags: spanContext.traceFlags,
		traceId: spanContext.traceId
	};
};
