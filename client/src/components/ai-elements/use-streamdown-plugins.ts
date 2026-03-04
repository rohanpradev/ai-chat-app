"use client";

import { cjk } from "@streamdown/cjk";
import { math } from "@streamdown/math";
import { useEffect, useMemo, useState } from "react";

const MERMAID_FENCE_REGEX = /```mermaid\b/i;

type MermaidPlugin = (typeof import("@streamdown/mermaid"))["mermaid"];

// Streamdown ships built-in code highlighting; we only layer extra plugins here.
const basePlugins = { cjk, math };

export const useStreamdownPlugins = (content: unknown) => {
  const [mermaidPlugin, setMermaidPlugin] = useState<MermaidPlugin | null>(
    null,
  );

  const shouldLoadMermaid =
    typeof content === "string" && MERMAID_FENCE_REGEX.test(content);

  useEffect(() => {
    if (!shouldLoadMermaid || mermaidPlugin) {
      return;
    }

    let cancelled = false;

    void import("@streamdown/mermaid")
      .then((module) => {
        if (!cancelled) {
          setMermaidPlugin(() => module.mermaid);
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
    () =>
      mermaidPlugin ? { ...basePlugins, mermaid: mermaidPlugin } : basePlugins,
    [mermaidPlugin],
  );
};
