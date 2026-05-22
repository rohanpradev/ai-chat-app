"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
import type { ComponentProps } from "react";
import type { Streamdown } from "streamdown";

type StreamdownPlugins = NonNullable<ComponentProps<typeof Streamdown>["plugins"]>;

const streamdownPlugins = { cjk, code, math, mermaid } satisfies StreamdownPlugins;

export const useStreamdownPlugins = (_content: unknown) => streamdownPlugins;
