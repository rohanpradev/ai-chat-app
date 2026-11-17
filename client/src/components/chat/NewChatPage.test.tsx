/** @vitest-environment jsdom */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StrictMode, Suspense } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { Route } from "@/routes/chat/new";

const { createConversation, navigate } = vi.hoisted(() => ({ createConversation: vi.fn(), navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));
vi.mock("@/composables/useApi", () => ({ getApiClient: () => ({ conversations: { create: createConversation } }) }));
vi.mock("@/routes/chat/$conversationId", () => ({ Route: { to: "/chat/$conversationId" } }));
vi.mock("@/routes/chat/index", () => ({ Route: { to: "/chat" } }));

afterEach(cleanup);

it("keeps the new-chat page open after a failure and retries creation once", async () => {
  createConversation
    .mockRejectedValueOnce(new Error("Temporarily unavailable"))
    .mockResolvedValueOnce({ id: "chat-1" });
  const queryClient = new QueryClient();
  const NewChatPage = Route.options.component;
  if (!NewChatPage) throw new Error("Expected a new-chat page");

  await act(async () => {
    render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <Suspense>
            <NewChatPage />
          </Suspense>
        </QueryClientProvider>
      </StrictMode>,
    );
  });

  await screen.findByRole("alert");
  expect(createConversation).toHaveBeenCalledTimes(1);
  expect(navigate).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() =>
    expect(navigate).toHaveBeenCalledExactlyOnceWith({
      params: { conversationId: "chat-1" },
      replace: true,
      to: "/chat/$conversationId",
    }),
  );
  expect(createConversation.mock.calls).toEqual([[{ title: "New Chat" }], [{ title: "New Chat" }]]);
});
