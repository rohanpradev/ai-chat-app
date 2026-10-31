/** @vitest-environment jsdom */
import type { MyUIMessage } from "@chat-app/shared";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChatMessages } from "@/components/chat/ChatMessages";

afterEach(cleanup);

describe("chat markdown streaming controls", () => {
  it("keeps completed code blocks usable while the current answer streams", () => {
    const messages: MyUIMessage[] = [
      {
        id: "first",
        role: "assistant",
        parts: [{ type: "text", text: "```ts\nconst first = 1;\n```", state: "done" }],
      },
      { id: "user", role: "user", parts: [{ type: "text", text: "Another example" }] },
      {
        id: "current",
        role: "assistant",
        parts: [
          { type: "text", text: "```ts\nconst second = 2;\n```", state: "done" },
          { type: "text", text: "```ts\nconst third = 3;\n", state: "streaming" },
        ],
      },
    ];
    render(<ChatMessages messages={messages} status="streaming" />);

    const buttons = screen.getAllByRole("button", { name: /copy code/i });
    expect(buttons).toHaveLength(3);
    expect(buttons.map((button) => button.hasAttribute("disabled"))).toEqual([false, false, true]);
  });
});
