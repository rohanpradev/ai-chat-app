/** @vitest-environment jsdom */

import * as Sentry from "@sentry/react";
import { createRootRoute, createRouter } from "@tanstack/react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@sentry/react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@sentry/react")>()),
  init: vi.fn(),
}));

describe("browser telemetry privacy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("opts out of Sentry 11 content collection when telemetry is enabled", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "https://public@example.invalid/1");
    const { initializeSentry } = await import("./sentry");
    const router = createRouter({ routeTree: createRootRoute() });
    initializeSentry(router);
    initializeSentry(router);

    expect(Sentry.init).toHaveBeenCalledTimes(1);
    expect(vi.mocked(Sentry.init).mock.calls[0]?.[0]?.dataCollection).toEqual({
      cookies: false,
      databaseQueryData: false,
      genAI: { inputs: false, outputs: false },
      graphQL: { document: false, variables: false },
      httpBodies: [],
      httpHeaders: false,
      queues: false,
      stackFrameVariables: false,
      urlQueryParams: false,
      userInfo: false,
    });
  });

  it("does not initialize telemetry without a DSN", async () => {
    vi.stubEnv("VITE_SENTRY_DSN", "");
    const { initializeSentry } = await import("./sentry");
    initializeSentry(createRouter({ routeTree: createRootRoute() }));
    expect(Sentry.init).not.toHaveBeenCalled();
  });
});
