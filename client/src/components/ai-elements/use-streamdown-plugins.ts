"use client";

import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Streamdown } from "streamdown";

type StreamdownPlugins = NonNullable<ComponentProps<typeof Streamdown>["plugins"]>;

const hasCjk = (content: string) => /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(content);

export const useStreamdownPlugins = (content: unknown) => {
  const text = typeof content === "string" ? content : "";
  const requirements = useMemo(
    () => {
      const fences = [...text.matchAll(/^[\t >]*(?:`{3,}|~{3,})[\t ]*([^\s`~]*)/gm)];
      // Wait for whitespace after the language before loading a fallback: an
      // in-progress `ty` fence may still become the compact `typescript` grammar.
      const languages = fences
        .filter((match) => match.index + match[0].length < text.length)
        .map((match) => match[1]?.toLowerCase() ?? "");

      return {
        cjk: hasCjk(text),
        code: fences.length > 0,
        codeLanguages: [...new Set(languages.filter((language) => language && language !== "mermaid"))].sort().join("\n"),
        math: /(^|[^\\])\$\$?[^$]+\$\$?/m.test(text),
        mermaid: languages.includes("mermaid"),
      };
    },
    [text],
  );
  const [plugins, setPlugins] = useState<StreamdownPlugins>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [cjkPlugin, codePlugin, mathPlugin, mermaidPlugin] = await Promise.all([
        requirements.cjk ? import("@streamdown/cjk").then((module) => module.cjk) : undefined,
        requirements.code
          ? import("@/lib/streamdown-code-plugin").then((module) =>
              requirements.codeLanguages.split("\n").some((language) => language && !module.normalizeCompactLanguage(language))
                ? import("@streamdown/code").then((fallback) => fallback.code)
                : module.compactCodePlugin,
            )
          : undefined,
        requirements.math ? import("@/lib/streamdown-math-plugin").then((module) => module.math) : undefined,
        requirements.mermaid ? import("@streamdown/mermaid").then((module) => module.mermaid) : undefined,
      ]);

      if (active) {
        setPlugins({
          ...(cjkPlugin ? { cjk: cjkPlugin } : {}),
          ...(codePlugin ? { code: codePlugin } : {}),
          ...(mathPlugin ? { math: mathPlugin } : {}),
          ...(mermaidPlugin ? { mermaid: mermaidPlugin } : {}),
        });
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [requirements.cjk, requirements.code, requirements.codeLanguages, requirements.math, requirements.mermaid]);

  return plugins;
};
