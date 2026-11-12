/** @vitest-environment jsdom */
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useStreamdownPlugins } from "@/components/ai-elements/use-streamdown-plugins";

afterEach(cleanup);

vi.mock("@streamdown/mermaid", () => {
  throw new Error("Diagram renderer could not be loaded");
});

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

  it("still loads code highlighting when the diagram renderer fails to load", async () => {
    const { result } = renderHook(() => useStreamdownPlugins("```mermaid\ngraph TD\n```\n\n```ts\nconst n = 1;\n```"));

    await waitFor(() => expect(result.current.code?.supportsLanguage("typescript")).toBe(true));
    expect(result.current.mermaid).toBeUndefined();
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
