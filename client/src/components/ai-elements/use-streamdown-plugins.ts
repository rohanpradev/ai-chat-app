"use client";

import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import type { ComponentProps } from "react";
import { useEffect, useMemo, useState } from "react";
import type { Streamdown } from "streamdown";

const CODE_FENCE_REGEX = /```/;
const MERMAID_FENCE_REGEX = /```mermaid\b/i;

type StreamdownPlugins = NonNullable<ComponentProps<typeof Streamdown>["plugins"]>;
type CodePlugin = (typeof import("@streamdown/code"))["code"];
type MermaidPlugin = (typeof import("@streamdown/mermaid"))["mermaid"];

const basePlugins = { cjk, math } satisfies StreamdownPlugins;

let codePluginPromise: Promise<CodePlugin> | undefined;
let mermaidPluginPromise: Promise<MermaidPlugin> | undefined;

const loadCodePlugin = () => {
  codePluginPromise ??= import("@streamdown/code").then((module) => module.code);
  return codePluginPromise;
};

const loadMermaidPlugin = () => {
  mermaidPluginPromise ??= import("@streamdown/mermaid").then((module) => module.mermaid);
  return mermaidPluginPromise;
};

export const useStreamdownPlugins = (content: unknown) => {
  const [codePlugin, setCodePlugin] = useState<CodePlugin | null>(null);
  const [mermaidPlugin, setMermaidPlugin] = useState<MermaidPlugin | null>(
    null,
  );

  const shouldLoadCode =
    typeof content === "string" && CODE_FENCE_REGEX.test(content);
  const shouldLoadMermaid =
    typeof content === "string" && MERMAID_FENCE_REGEX.test(content);

  useEffect(() => {
    if (!shouldLoadCode || codePlugin) {
      return;
    }

    let cancelled = false;

    void loadCodePlugin()
      .then((plugin) => {
        if (!cancelled) {
          setCodePlugin(() => plugin);
        }
      })
      .catch(() => {
        // Graceful fallback: fenced code still renders without highlighting.
      });

    return () => {
      cancelled = true;
    };
  }, [codePlugin, shouldLoadCode]);

  useEffect(() => {
    if (!shouldLoadMermaid || mermaidPlugin) {
      return;
    }

    let cancelled = false;

    void loadMermaidPlugin()
      .then((plugin) => {
        if (!cancelled) {
          setMermaidPlugin(() => plugin);
        }
      })
      .catch(() => {
        // Graceful fallback: markdown renders without Mermaid diagrams.
      });

    return () => {
      cancelled = true;
    };
  }, [mermaidPlugin, shouldLoadMermaid]);

  return useMemo(
    () => {
      if (!(codePlugin || mermaidPlugin)) {
        return basePlugins;
      }

      return {
        ...basePlugins,
        ...(codePlugin ? { code: codePlugin } : null),
        ...(mermaidPlugin ? { mermaid: mermaidPlugin } : null),
      } satisfies StreamdownPlugins;
    },
    [codePlugin, mermaidPlugin],
  );
};
