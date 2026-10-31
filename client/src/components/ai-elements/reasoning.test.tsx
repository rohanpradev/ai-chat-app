/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Reasoning, ReasoningContent } from "@/components/ai-elements/reasoning";

afterEach(cleanup);

describe("ReasoningContent", () => {
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
