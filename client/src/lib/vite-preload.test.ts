/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";
import { installVitePreloadErrorHandler } from "@/lib/vite-preload";

describe("installVitePreloadErrorHandler", () => {
  afterEach(() => {
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
});
