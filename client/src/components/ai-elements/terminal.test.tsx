import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Terminal } from "@/components/ai-elements/terminal";

describe("Terminal", () => {
  it("renders ANSI colors without turning terminal output into links", () => {
    const html = renderToStaticMarkup(
      <Terminal output={"\u001b[31mred\u001b[0m https://example.com"} />
    );

    expect(html).toContain("red");
    expect(html).toContain("color:rgb(");
    expect(html).not.toContain("<a ");
  });

  it("applies terminal backspace behavior", () => {
    const html = renderToStaticMarkup(<Terminal output={"hellx\bo"} />);

    expect(html).toContain("hello");
    expect(html).not.toContain("hellx");
  });
});
