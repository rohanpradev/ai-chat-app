import type { ErrorEvent } from "@sentry/bun";
import * as Sentry from "@sentry/bun";
import { sentry } from "@sentry/hono/bun";
import { asAppMiddleware } from "@/lib/hono-compat";
import type { AppOpenAPI } from "@/lib/types";
import env from "@/utils/env";

const sensitiveFieldPattern = /authorization|cookie|password|secret|token|api[_-]?key/i;

const instrumentedApps = new WeakSet<AppOpenAPI>();

const redactSensitiveFields = (value: unknown, depth = 0): unknown => {
	if (!value || depth > 4) {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => redactSensitiveFields(item, depth + 1));
	}

	if (typeof value !== "object") {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value).map(([key, entryValue]) => [
			key,
			sensitiveFieldPattern.test(key) ? "[Filtered]" : redactSensitiveFields(entryValue, depth + 1)
		])
	);
};

const redactRequest = (event: ErrorEvent) => {
	// Hono's SDK normalizes cookies separately from the raw Cookie header.
	// Scrubbing only headers would leave session credentials in the event.
	if (event.request) delete event.request.cookies;
	const requestUrl = event.request?.url;
	if (requestUrl) {
		try {
			if (["/health", "/ready"].includes(new URL(requestUrl).pathname)) return null;
		} catch {
			// An invalid telemetry URL must not prevent error reporting.
		}
	}
	const headers = event.request?.headers;

	if (headers) {
		for (const key of Object.keys(headers)) {
			if (sensitiveFieldPattern.test(key)) {
				headers[key] = "[Filtered]";
			}
		}
	}

	if (!event.request?.data || typeof event.request.data !== "object") {
		return event;
	}

	event.request.data = redactSensitiveFields(event.request.data);

	return event;
};

const isSentryEnabled = Boolean(env.SENTRY_DSN);

export function captureSentryException(error: unknown, tags: Record<string, string> = {}) {
	if (!isSentryEnabled) {
		return;
	}

	Sentry.withScope((scope) => {
		scope.setTags(tags);
		Sentry.captureException(error);
	});
}

export function setupSentryForHono(app: AppOpenAPI) {
	if (!isSentryEnabled || instrumentedApps.has(app)) {
		return;
	}

	app.use(
		"*",
		asAppMiddleware(
			sentry(app, {
				beforeSend: redactRequest,
				dsn: env.SENTRY_DSN,
				environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
				integrations: [
					Sentry.vercelAIIntegration({
						enableTruncation: true,
						force: true,
						recordInputs: false,
						recordOutputs: false
					})
				],
				release: env.SENTRY_RELEASE,
				sendDefaultPii: env.SENTRY_SEND_DEFAULT_PII,
				streamGenAiSpans: true,
				tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE
			})
		)
	);
	instrumentedApps.add(app);
}
