import { describe, expect, it } from "vitest";
import { highlightCode } from "@/components/ai-elements/code-block";

describe("highlightCode", () => {
  it("renders unknown languages as plain text synchronously", () => {
    const result = highlightCode("hello", "not-a-real-language");

    expect(result?.tokens[0]?.[0]?.content).toBe("hello");
    expect(result?.tokens[0]?.[0]?.color).toBe("inherit");
  });

  it("normalizes Shiki plain text aliases to plain text", () => {
    const result = highlightCode("hello", "TXT");

    expect(result?.tokens[0]?.[0]?.content).toBe("hello");
    expect(result?.tokens[0]?.[0]?.color).toBe("inherit");
  });

  it("supports Shiki ANSI highlighting without a bundled language", async () => {
    const code = "\u001b[31mred\u001b[0m";
    const result = await new Promise<NonNullable<ReturnType<typeof highlightCode>>>((resolve) => {
      const syncResult = highlightCode(code, "ansi", resolve);

      if (syncResult) {
        resolve(syncResult);
      }
    });

    const token = result.tokens[0]?.[0];

    expect(token?.content).toBe("red");
    expect(token?.htmlStyle?.color ?? token?.color).toBeTruthy();
  });
});
