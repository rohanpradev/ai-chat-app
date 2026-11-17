import type { ConversationDetail } from "@chat-app/shared";
import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getConversationQuery } from "@/queries/getConversation";

afterEach(() => vi.unstubAllGlobals());

describe("conversation query cancellation", () => {
  it("aborts the Hono request and keeps the prior saved transcript", async () => {
    let requestSignal: AbortSignal | null | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        requestSignal = init?.signal;
        return new Promise<Response>((_resolve, reject) => {
          requestSignal?.addEventListener("abort", () => reject(requestSignal?.reason), { once: true });
        });
      }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const query = getConversationQuery("saved-conversation");
    const saved = {
      createdAt: "2026-10-28T00:00:00.000Z",
      id: "saved-conversation",
      messages: [
        { id: "saved-answer", parts: [{ type: "text", text: "Keep this answer", state: "done" }], role: "assistant" },
      ],
      title: "Saved conversation",
      updatedAt: null,
    } satisfies ConversationDetail;
    client.setQueryData(query.queryKey, saved);
    const pending = client.query({ ...query, staleTime: 0 }).catch((error: unknown) => error);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledOnce());
    await client.cancelQueries({ queryKey: query.queryKey });

    expect(requestSignal?.aborted).toBe(true);
    expect(await pending).toEqual(saved);
    expect(client.getQueryData(query.queryKey)).toEqual(saved);
    expect(client.getQueryState(query.queryKey)?.fetchStatus).toBe("idle");
    client.clear();
  });
});
