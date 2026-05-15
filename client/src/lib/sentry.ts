import type { User } from "@chat-app/shared";
import * as Sentry from "@sentry/react";

type SentryRouter = Parameters<typeof Sentry.tanstackRouterBrowserTracingIntegration>[0];

const sensitiveFieldPattern = /authorization|cookie|password|secret|token|api[_-]?key/i;

const parseSampleRate = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, parsed));
};

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
      sensitiveFieldPattern.test(key) ? "[Filtered]" : redactSensitiveFields(entryValue, depth + 1),
    ]),
  );
};

const redactRequest = (event: Sentry.ErrorEvent) => {
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

const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
const sentryEnvironment = import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE;
const sentryRelease = import.meta.env.VITE_SENTRY_RELEASE || import.meta.env.VITE_APP_VERSION;

let initialized = false;

export const isSentryEnabled = () => Boolean(sentryDsn);

export const initializeSentry = (router: SentryRouter) => {
  if (!sentryDsn || initialized) {
    return;
  }

  Sentry.init({
    beforeSend: redactRequest,
    dsn: sentryDsn,
    environment: sentryEnvironment,
    integrations: [
      Sentry.tanstackRouterBrowserTracingIntegration(router),
      Sentry.replayIntegration({
        blockAllMedia: true,
        maskAllText: true,
      }),
    ],
    release: sentryRelease,
    replaysOnErrorSampleRate: parseSampleRate(import.meta.env.VITE_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE, 0.1),
    replaysSessionSampleRate: parseSampleRate(import.meta.env.VITE_SENTRY_REPLAYS_SESSION_SAMPLE_RATE, 0),
    sendDefaultPii: false,
    tracePropagationTargets: [/^\/api\//],
    tracesSampleRate: parseSampleRate(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE, 0.1),
  });

  initialized = true;
};

export const setSentryUser = (user: Pick<User, "id"> | null) => {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.setUser(user ? { id: user.id } : null);
};

export const captureSentryException = (error: unknown) => {
  if (!isSentryEnabled()) {
    return;
  }

  Sentry.captureException(error);
};

export const SentryErrorBoundary = Sentry.ErrorBoundary;
