/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Reasoning, ReasoningContent, ReasoningTrigger } from "@/components/ai-elements/reasoning";

afterEach(cleanup);

describe("ReasoningContent", () => {
  it("lets users collapse reasoning while it is still streaming", () => {
    render(
      <Reasoning isStreaming>
        <ReasoningTrigger />
        <ReasoningContent>Streaming reasoning</ReasoningContent>
      </Reasoning>,
    );

    const trigger = screen.getByRole("button", { name: /thinking/i });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("disables markdown controls until reasoning finishes streaming", () => {
    const { rerender } = render(
      <Reasoning open isStreaming>
        <ReasoningContent>{"```typescript\nconst answer = 42;\n```"}</ReasoningContent>
      </Reasoning>,
    );

    expect(screen.getByRole("button", { name: /copy code/i }).hasAttribute("disabled")).toBe(true);

    rerender(
      <Reasoning open isStreaming={false}>
        <ReasoningContent>{"```typescript\nconst answer = 42;\n```"}</ReasoningContent>
      </Reasoning>,
    );

    expect(screen.getByRole("button", { name: /copy code/i }).hasAttribute("disabled")).toBe(false);
  });
});
