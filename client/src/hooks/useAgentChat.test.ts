/** @vitest-environment jsdom */
import type { ConversationDetail } from "@chat-app/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAgentChat } from "@/hooks/useAgentChat";
import { AI_QUERY_KEY, CHAT_QUERY_KEY } from "@/utils/query-key";

const conversation: ConversationDetail = {
  createdAt: "2026-10-22T00:00:00.000Z",
  id: "chat-cache",
  messages: [],
  title: "Cached conversation",
  updatedAt: null,
};

function streamResponse(text: string, error?: string) {
  const chunks = [
    { type: "start", messageId: "assistant-cache" },
    { type: "text-start", id: "text-cache" },
    { type: "text-delta", id: "text-cache", delta: text },
    ...(error ? [{ type: "error", errorText: error }] : [{ type: "text-end", id: "text-cache" }, { type: "finish" }]),
  ];
  return new Response(`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("")}data: [DONE]\n\n`, {
    headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
  });
}

function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(CHAT_QUERY_KEY.conversation(conversation.id), conversation);
  queryClient.setQueryData(AI_QUERY_KEY.models, [
    { id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "vercel-ai-gateway" },
  ]);
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  return { ...renderHook(() => useAgentChat({ conversationId: conversation.id }), { wrapper }), queryClient };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("saved chat cache", () => {
  it("restores the current transcript after streaming and regeneration", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(streamResponse("First answer"))
      .mockResolvedValueOnce(streamResponse("Revised answer"));
    vi.stubGlobal("fetch", fetch);
    const { result, queryClient, unmount } = setup();

    await act(async () => result.current.sendPromptMessage({ files: [], text: "Keep my transcript" }));
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(
      queryClient.getQueryData<ConversationDetail>(CHAT_QUERY_KEY.conversation(conversation.id))?.messages,
    ).toEqual(result.current.messages);

    await act(async () => result.current.regenerate());
    expect(
      queryClient.getQueryData<ConversationDetail>(CHAT_QUERY_KEY.conversation(conversation.id))?.messages,
    ).toEqual(result.current.messages);
    expect(result.current.messages.at(-1)?.parts).toContainEqual({
      type: "text",
      text: "Revised answer",
      state: "done",
    });
    unmount();
  });

  it("preserves accepted prompts and partial answers after a stream error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(streamResponse("Partial answer", "Provider disconnected")));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { result, queryClient, unmount } = setup();
    await act(async () => result.current.sendPromptMessage({ files: [], text: "Keep my prompt" }));
    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(
      queryClient.getQueryData<ConversationDetail>(CHAT_QUERY_KEY.conversation(conversation.id))?.messages,
    ).toEqual(result.current.messages);
    expect(result.current.messages).toHaveLength(2);
    unmount();
  });

  it("keeps the interrupted transcript when a response is stopped", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of [
          { type: "start", messageId: "assistant-interrupted" },
          { type: "text-start", id: "text-interrupted" },
          { type: "text-delta", id: "text-interrupted", delta: "Interrupted answer" },
        ]) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(stream, {
          headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
        }),
      ),
    );
    const { result, queryClient, unmount } = setup();
    let sending: Promise<void> | undefined;
    act(() => {
      sending = result.current.sendPromptMessage({ files: [], text: "Stop safely" });
    });
    await waitFor(() =>
      expect(result.current.messages.at(-1)?.parts).toContainEqual(
        expect.objectContaining({ text: "Interrupted answer" }),
      ),
    );
    await act(async () => {
      await result.current.stop();
      await sending;
    });
    expect(result.current.status).toBe("ready");
    expect(
      queryClient.getQueryData<ConversationDetail>(CHAT_QUERY_KEY.conversation(conversation.id))?.messages,
    ).toEqual(result.current.messages);
    unmount();
  });
});
