"use client";

import { createBundledHighlighter, makeSingletonHighlighter } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import type { HighlighterGeneric, ThemedToken } from "@shikijs/types";

type CodeTheme = "github-dark" | "github-light";

export interface TokenizedCode {
  tokens: ThemedToken[][];
  fg: string;
  bg: string;
}

const CODE_THEME_VARIANTS = {
  dark: "github-dark",
  light: "github-light",
} as const satisfies Record<"dark" | "light", CodeTheme>;

const CODE_THEME_NAMES = Object.values(CODE_THEME_VARIANTS);

const CODE_LANGUAGE_LOADERS = {
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  jsx: () => import("@shikijs/langs/jsx"),
  markdown: () => import("@shikijs/langs/markdown"),
  shellscript: () => import("@shikijs/langs/shellscript"),
  sql: () => import("@shikijs/langs/sql"),
  tsx: () => import("@shikijs/langs/tsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  yaml: () => import("@shikijs/langs/yaml"),
} as const;

type SupportedCodeLanguage = keyof typeof CODE_LANGUAGE_LOADERS;

const CODE_LANGUAGE_ALIASES: Readonly<Record<string, SupportedCodeLanguage | null>> = {
  bash: "shellscript",
  js: "javascript",
  json5: "json",
  jsonc: "json",
  md: "markdown",
  plain: null,
  plaintext: null,
  shell: "shellscript",
  sh: "shellscript",
  text: null,
  ts: "typescript",
  yml: "yaml",
  zsh: "shellscript",
};

const isSupportedCodeLanguage = (language: string): language is SupportedCodeLanguage =>
  Object.hasOwn(CODE_LANGUAGE_LOADERS, language);

const createHighlighter = createBundledHighlighter<SupportedCodeLanguage, CodeTheme>({
  engine: () => createJavaScriptRegexEngine(),
  langs: CODE_LANGUAGE_LOADERS,
  themes: {
    "github-dark": () => import("@shikijs/themes/github-dark"),
    "github-light": () => import("@shikijs/themes/github-light"),
  },
});

const getSingletonHighlighter = makeSingletonHighlighter(createHighlighter);

const tokensCache = new Map<string, TokenizedCode>();
const pendingHighlights = new Map<string, Promise<TokenizedCode>>();
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

export const normalizeCodeInput = (code: string | null | undefined) => (typeof code === "string" ? code : "");

export const normalizeCodeLanguage = (language: string | null | undefined): SupportedCodeLanguage | null => {
  if (typeof language !== "string") {
    return null;
  }

  const normalizedLanguage = language.trim().toLowerCase();
  if (!normalizedLanguage) {
    return null;
  }

  const aliasedLanguage = CODE_LANGUAGE_ALIASES[normalizedLanguage];
  if (aliasedLanguage !== undefined) {
    return aliasedLanguage;
  }

  return isSupportedCodeLanguage(normalizedLanguage) ? normalizedLanguage : null;
};

const getLanguageCacheKey = (language: string | null | undefined) => {
  if (typeof language !== "string") {
    return "plain";
  }

  const normalizedLanguage = language.trim().toLowerCase();
  return (normalizeCodeLanguage(normalizedLanguage) ?? normalizedLanguage) || "plain";
};

export const getTokensCacheKey = (code: string, language: string | null | undefined) => {
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : "";

  return `${getLanguageCacheKey(language)}:${code.length}:${start}:${end}`;
};

export const createRawTokens = (code: string | null | undefined): TokenizedCode => {
  const normalizedCode = normalizeCodeInput(code);

  return {
    bg: "transparent",
    fg: "inherit",
    tokens: normalizedCode.split("\n").map((line) =>
      line === ""
        ? []
        : [
            {
              color: "inherit",
              content: line,
            } as ThemedToken,
          ],
    ),
  };
};

const getHighlighter = (
  language: SupportedCodeLanguage,
): Promise<HighlighterGeneric<SupportedCodeLanguage, CodeTheme>> =>
  getSingletonHighlighter({
    langs: [language],
    themes: CODE_THEME_NAMES,
  });

const notifySubscribers = (cacheKey: string, result: TokenizedCode) => {
  const cacheSubscribers = subscribers.get(cacheKey);
  if (!cacheSubscribers) {
    return;
  }

  for (const subscriber of cacheSubscribers) {
    subscriber(result);
  }

  subscribers.delete(cacheKey);
};

const startHighlight = (code: string, language: SupportedCodeLanguage, cacheKey: string) => {
  const pending = pendingHighlights.get(cacheKey);
  if (pending) {
    return pending;
  }

  const highlightPromise = getHighlighter(language)
    .then((highlighter) => {
      const result = highlighter.codeToTokens(code, {
        lang: language,
        themes: CODE_THEME_VARIANTS,
      });

      const tokenized: TokenizedCode = {
        bg: result.bg ?? "transparent",
        fg: result.fg ?? "inherit",
        tokens: result.tokens,
      };

      tokensCache.set(cacheKey, tokenized);
      notifySubscribers(cacheKey, tokenized);

      return tokenized;
    })
    .catch((error) => {
      subscribers.delete(cacheKey);
      throw error;
    })
    .finally(() => {
      pendingHighlights.delete(cacheKey);
    });

  pendingHighlights.set(cacheKey, highlightPromise);
  return highlightPromise;
};

export const highlightCode = (
  code: string | null | undefined,
  language: string | null | undefined,
  callback?: (result: TokenizedCode) => void,
): TokenizedCode | null => {
  const normalizedCode = normalizeCodeInput(code);
  const normalizedLanguage = normalizeCodeLanguage(language);

  if (!normalizedCode || !normalizedLanguage) {
    return createRawTokens(normalizedCode);
  }

  const cacheKey = getTokensCacheKey(normalizedCode, normalizedLanguage);
  const cached = tokensCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  if (callback) {
    const cacheSubscribers = subscribers.get(cacheKey) ?? new Set();
    cacheSubscribers.add(callback);
    subscribers.set(cacheKey, cacheSubscribers);
  }

  void startHighlight(normalizedCode, normalizedLanguage, cacheKey).catch((error) => {
    console.error("Failed to highlight code:", error);
  });

  return null;
};
