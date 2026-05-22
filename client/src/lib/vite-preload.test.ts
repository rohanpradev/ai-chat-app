/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { installVitePreloadErrorHandler } from "@/lib/vite-preload";

describe("installVitePreloadErrorHandler", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("prevents the default preload failure and reloads the page", () => {
    const reloadPage = vi.fn();
    const dispose = installVitePreloadErrorHandler(reloadPage);
    const event = new Event("vite:preloadError", { cancelable: true });

    const dispatchResult = window.dispatchEvent(event);

    expect(dispatchResult).toBe(false);
    expect(event.defaultPrevented).toBe(true);
    expect(reloadPage).toHaveBeenCalledTimes(1);

    dispose();
  });

  it("does not reload repeatedly for the same preload failure", () => {
    const reloadPage = vi.fn();
    const dispose = installVitePreloadErrorHandler(reloadPage);
    const firstEvent = new Event("vite:preloadError", { cancelable: true });
    const secondEvent = new Event("vite:preloadError", { cancelable: true });

    const firstDispatchResult = window.dispatchEvent(firstEvent);
    const secondDispatchResult = window.dispatchEvent(secondEvent);

    expect(firstDispatchResult).toBe(false);
    expect(firstEvent.defaultPrevented).toBe(true);
    expect(secondDispatchResult).toBe(true);
    expect(secondEvent.defaultPrevented).toBe(false);
    expect(reloadPage).toHaveBeenCalledTimes(1);

    dispose();
  });
});
