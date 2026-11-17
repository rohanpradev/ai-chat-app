import { createHighlighterCore } from "@shikijs/core";
import { createJavaScriptRegexEngine } from "@shikijs/engine-javascript";
import type { ThemeRegistration, TokensResult } from "@shikijs/types";
import type { CodeHighlighterPlugin } from "@streamdown/code";

const themes = ["github-light", "github-dark"] as const;
const languageLoaders = {
  bash: () => import("@shikijs/langs/bash"),
  css: () => import("@shikijs/langs/css"),
  html: () => import("@shikijs/langs/html"),
  javascript: () => import("@shikijs/langs/javascript"),
  json: () => import("@shikijs/langs/json"),
  jsx: () => import("@shikijs/langs/jsx"),
  markdown: () => import("@shikijs/langs/markdown"),
  python: () => import("@shikijs/langs/python"),
  sql: () => import("@shikijs/langs/sql"),
  tsx: () => import("@shikijs/langs/tsx"),
  typescript: () => import("@shikijs/langs/typescript"),
  yaml: () => import("@shikijs/langs/yaml"),
} as const;

type SupportedLanguage = keyof typeof languageLoaders;

const aliases: Record<string, SupportedLanguage> = {
  console: "bash",
  html5: "html",
  js: "javascript",
  jscript: "javascript",
  md: "markdown",
  py: "python",
  shell: "bash",
  sh: "bash",
  ts: "typescript",
  yml: "yaml",
};
const supportedLanguages = Object.keys(languageLoaders) as SupportedLanguage[];
let highlighter: ReturnType<typeof createHighlighterCore> | undefined;
const languageLoads = new Map<SupportedLanguage, ReturnType<typeof createHighlighterCore>>();

export const normalizeCompactLanguage = (language: string): SupportedLanguage | undefined => {
  const normalized = language.trim().toLowerCase();
  const candidate = Object.hasOwn(aliases, normalized) ? aliases[normalized] : normalized;
  return candidate && Object.hasOwn(languageLoaders, candidate) ? (candidate as SupportedLanguage) : undefined;
};

const getHighlighter = (language: SupportedLanguage) => {
  const existing = languageLoads.get(language);
  if (existing) {
    return existing;
  }

  // Reuse Shiki's expensive engine and theme registry across every code block.
  // Each grammar remains an independent lazy import.
  highlighter ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: [],
    themes: [
      import("@shikijs/themes/github-light").then((module) => module.default as ThemeRegistration),
      import("@shikijs/themes/github-dark").then((module) => module.default as ThemeRegistration),
    ],
  });
  const loaded = highlighter.then(async (instance) => {
    await instance.loadLanguage(await languageLoaders[language]().then((module) => module.default));
    return instance;
  });
  languageLoads.set(language, loaded);
  void loaded.catch(() => languageLoads.delete(language));
  return loaded;
};

export const highlightCompactCode = (code: string, language: string) => {
  const supportedLanguage = normalizeCompactLanguage(language);
  if (!supportedLanguage) {
    return null;
  }

  return getHighlighter(supportedLanguage).then((highlighter) =>
    highlighter.codeToTokens(code, {
      lang: supportedLanguage,
      themes: { dark: themes[1], light: themes[0] },
    }),
  );
};

export const compactCodePlugin: CodeHighlighterPlugin = {
  getSupportedLanguages: () => supportedLanguages,
  getThemes: () => [...themes],
  highlight: ({ code, language }, callback) => {
    const result = highlightCompactCode(code, language);
    if (!result) {
      return null;
    }

    void result.then((result) => callback?.(result as TokensResult)).catch(() => undefined);
    return null;
  },
  name: "shiki",
  supportsLanguage: (language) => Boolean(normalizeCompactLanguage(language)),
  type: "code-highlighter",
};
