import type { ErrorEvent } from "@sentry/bun";
import * as Sentry from "@sentry/bun";
import type { AppOpenAPI } from "@/lib/types";
import env from "@/utils/env";

const sensitiveFieldPattern = /authorization|cookie|password|secret|token|api[_-]?key/i;

let initialized = false;

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

export function initializeSentry() {
	if (!isSentryEnabled || initialized) {
		return;
	}

	Sentry.init({
		beforeSend: redactRequest,
		dsn: env.SENTRY_DSN,
		environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
		integrations: [Sentry.honoIntegration()],
		release: env.SENTRY_RELEASE,
		sendDefaultPii: env.SENTRY_SEND_DEFAULT_PII,
		tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE
	});

	initialized = true;
}

export function setupSentryForHono(app: AppOpenAPI) {
	if (!isSentryEnabled) {
		return;
	}

	initializeSentry();

	Sentry.setupHonoErrorHandler(app as Parameters<typeof Sentry.setupHonoErrorHandler>[0], {
		shouldHandleError: (context) => context.req.path !== "/health" && context.res.status >= 500
	});
}
