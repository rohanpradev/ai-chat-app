"use client";

import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Streamdown } from "streamdown";

type StreamdownPlugins = NonNullable<ComponentProps<typeof Streamdown>["plugins"]>;

const hasCjk = (content: string) => /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(content);

export const useStreamdownPlugins = (content: unknown) => {
  const text = typeof content === "string" ? content : "";
  const requirements = useMemo(
    () => ({
      cjk: hasCjk(text),
      code: text.includes("```"),
      math: /(^|[^\\])\$\$?[^$]+\$\$?/m.test(text),
      mermaid: /```mermaid\b/i.test(text),
    }),
    [text],
  );
  const [plugins, setPlugins] = useState<StreamdownPlugins>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      const [cjkPlugin, codePlugin, mathPlugin, mermaidPlugin] = await Promise.all([
        requirements.cjk ? import("@streamdown/cjk").then((module) => module.cjk) : undefined,
        requirements.code ? import("@/lib/streamdown-code-plugin").then((module) => module.compactCodePlugin) : undefined,
        requirements.math ? import("@streamdown/math").then((module) => module.math) : undefined,
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
  }, [requirements.cjk, requirements.code, requirements.math, requirements.mermaid]);

  return plugins;
};
