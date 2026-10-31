import { describe, expect, it } from "vitest";
import { highlightCompactCode, normalizeCompactLanguage } from "@/lib/streamdown-code-plugin";

describe("compact syntax highlighting", () => {
  it("treats inherited object names and unsupported languages as plain text", () => {
    for (const language of ["constructor", "__proto__", "toString", "made-up-language"]) {
      expect(normalizeCompactLanguage(language)).toBeUndefined();
      expect(highlightCompactCode("plain text", language)).toBeNull();
    }
  });

  it("loads concurrent languages and aliases with light and dark token colors", async () => {
    const results = await Promise.all([
      highlightCompactCode("const answer = 42;", " TS "),
      highlightCompactCode('print("hello")', "python"),
      highlightCompactCode("const greeting = 'hello';", "typescript"),
    ]);

    for (const result of results) {
      expect(result?.tokens.flat().some((token) => token.htmlStyle?.color && token.htmlStyle?.["--shiki-dark"])).toBe(
        true,
      );
    }
    expect(
      results[0]?.tokens
        .flat()
        .map((token) => token.content)
        .join(""),
    ).toBe("const answer = 42;");
    expect(
      results[1]?.tokens
        .flat()
        .map((token) => token.content)
        .join(""),
    ).toBe('print("hello")');
  });
});
