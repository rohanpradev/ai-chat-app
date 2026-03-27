// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { ToolInput } from "@/components/ai-elements/tool";

describe("AI element tool rendering", () => {
  it("renders a placeholder while tool input is still streaming", () => {
    render(<ToolInput input={undefined as never} />);

    expect(screen.getByText("Parameters are still streaming.")).toBeTruthy();
  });

  it("does not throw when a code block receives undefined code", () => {
    expect(() =>
      render(<CodeBlock code={undefined} language="json" />),
    ).not.toThrow();
  });

  it("renders unsupported code languages as plain text instead of crashing", () => {
    render(<CodeBlock code={"console.log('hello')"} language="custom-lang" />);

    expect(screen.getByText("console.log('hello')")).toBeTruthy();
  });
});
