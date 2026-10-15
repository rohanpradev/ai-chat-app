/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useMcpRequest } from "@/hooks/useMcpRequest";

function setup() {
  const pending: Array<{ signal: AbortSignal; resolve: (value: string) => void }> = [];
  const queryClient = new QueryClient();
  const request = (_input: string, signal: AbortSignal) =>
    new Promise<string>((resolve) => {
      pending.push({ signal, resolve });
    });
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const hook = renderHook(() => useMcpRequest(request), { wrapper });
  return { ...hook, pending };
}

describe("MCP request cancellation", () => {
  it("aborts pending reads and ignores late completion after cancellation", async () => {
    const { result, pending, unmount } = setup();
    act(() => result.current.start("first"));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => result.current.cancel("Cancelled"));
    expect(pending[0]?.signal.aborted).toBe(true);
    await act(async () => pending[0]?.resolve("Late result"));
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toBeUndefined();
    expect(result.current.error).toBeNull();
    expect(result.current.notice).toBe("Cancelled");
    unmount();
  });
  it("keeps the newest response when a previous request finishes late", async () => {
    const { result, pending, unmount } = setup();
    act(() => result.current.start("first"));
    await waitFor(() => expect(pending).toHaveLength(1));
    act(() => result.current.start("second"));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0]?.signal.aborted).toBe(true);
    await act(async () => pending[1]?.resolve("Current result"));
    await waitFor(() => expect(result.current.data).toBe("Current result"));
    await act(async () => pending[0]?.resolve("Old result"));
    expect(result.current.data).toBe("Current result");
    unmount();
  });
  it("aborts when the user leaves the capability", async () => {
    const { result, pending, unmount } = setup();
    act(() => result.current.start("first"));
    await waitFor(() => expect(pending).toHaveLength(1));
    unmount();
    expect(pending[0]?.signal.aborted).toBe(true);
    pending[0]?.resolve("Unused result");
  });
});
