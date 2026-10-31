/** @vitest-environment jsdom */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useStreamdownPlugins } from "@/components/ai-elements/use-streamdown-plugins";

afterEach(cleanup);

describe("content-driven markdown plugins", () => {
  it("leaves plain reasoning free of optional rendering plugins", async () => {
    const { result } = renderHook(() => useStreamdownPlugins("Plain reasoning with no special formatting."));

    await waitFor(() => expect(result.current).toEqual({}));
  });

  it("highlights standard tilde fences using the compact code plugin", async () => {
    const { result } = renderHook(() => useStreamdownPlugins("~~~ts\nconst answer = 42;\n~~~"));

    await waitFor(() => expect(result.current.code?.supportsLanguage("typescript")).toBe(true));
    expect(result.current.code?.getSupportedLanguages()).not.toContain("rust");
  });

  it("retains the full upstream language support when another grammar is requested", async () => {
    const { result, rerender } = renderHook(({ text }) => useStreamdownPlugins(text), {
      initialProps: { text: "```rust\nfn main() {}\n```" },
    });

    await waitFor(() => expect(result.current.code?.supportsLanguage("rust")).toBe(true));

    rerender({ text: "```typescript\nconst answer = 42;\n```" });

    await waitFor(() => expect(result.current.code?.getSupportedLanguages()).not.toContain("rust"));
  });

  it("waits for the streamed fence language to finish before loading a fallback", async () => {
    const { result, rerender } = renderHook(({ text }) => useStreamdownPlugins(text), {
      initialProps: { text: "```ty" },
    });

    await waitFor(() => expect(result.current.code?.supportsLanguage("typescript")).toBe(true));
    expect(result.current.code?.getSupportedLanguages()).not.toContain("rust");

    rerender({ text: "```typescript\nconst answer = 42;" });

    await waitFor(() => expect(result.current.code?.getSupportedLanguages()).not.toContain("rust"));
  });
});
