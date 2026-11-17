/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MessageResponse } from "@/components/ai-elements/message";

afterEach(cleanup);

describe("MessageResponse", () => {
  it("updates Streamdown configuration when the markdown stays unchanged", () => {
    const { container, rerender } = render(<MessageResponse className="first-style">Same text</MessageResponse>);

    expect(container.firstElementChild?.classList.contains("first-style")).toBe(true);

    rerender(<MessageResponse className="updated-style">Same text</MessageResponse>);

    expect(container.firstElementChild?.classList.contains("updated-style")).toBe(true);
    expect(container.firstElementChild?.classList.contains("first-style")).toBe(false);
  });
});
