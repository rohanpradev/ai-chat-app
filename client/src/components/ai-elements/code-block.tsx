"use client";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon } from "lucide-react";
import type { ComponentProps, CSSProperties, HTMLAttributes } from "react";
import {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  BundledLanguage,
  BundledTheme,
  HighlighterGeneric,
  PlainTextLanguage,
  ThemedToken,
} from "shiki";
import { bundledLanguages, createHighlighter } from "shiki";

// Shiki uses bitflags for font styles: 1=italic, 2=bold, 4=underline
// oxlint-disable-next-line eslint(no-bitwise)
const isItalic = (fontStyle: number | undefined) => fontStyle && fontStyle & 1;
// oxlint-disable-next-line eslint(no-bitwise)
const isBold = (fontStyle: number | undefined) => fontStyle && fontStyle & 2;
const isUnderline = (fontStyle: number | undefined) =>
  // oxlint-disable-next-line eslint(no-bitwise)
  fontStyle && fontStyle & 4;

// Transform tokens to include pre-computed keys to avoid noArrayIndexKey lint
interface KeyedToken {
  token: ThemedToken;
  key: string;
}
interface KeyedLine {
  tokens: KeyedToken[];
  key: string;
}

const addKeysToTokens = (lines: ThemedToken[][]): KeyedLine[] =>
  lines.map((line, lineIdx) => ({
    key: `line-${lineIdx}`,
    tokens: line.map((token, tokenIdx) => ({
      key: `line-${lineIdx}-${tokenIdx}`,
      token,
    })),
  }));

// Token rendering component
const TokenSpan = ({ token }: { token: ThemedToken }) => (
  <span
    className="dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)]"
    style={
      {
        backgroundColor: token.bgColor,
        color: token.color,
        fontStyle: isItalic(token.fontStyle) ? "italic" : undefined,
        fontWeight: isBold(token.fontStyle) ? "bold" : undefined,
        textDecoration: isUnderline(token.fontStyle) ? "underline" : undefined,
        ...token.htmlStyle,
      } as CSSProperties
    }
  >
    {token.content}
  </span>
);

// Line number styles using CSS counters
const LINE_NUMBER_CLASSES = cn(
  "block",
  "before:content-[counter(line)]",
  "before:inline-block",
  "before:[counter-increment:line]",
  "before:w-8",
  "before:mr-4",
  "before:text-right",
  "before:text-muted-foreground/50",
  "before:font-mono",
  "before:select-none"
);

// Line rendering component
const LineSpan = ({
  keyedLine,
  showLineNumbers,
}: {
  keyedLine: KeyedLine;
  showLineNumbers: boolean;
}) => (
  <span className={showLineNumbers ? LINE_NUMBER_CLASSES : "block"}>
    {keyedLine.tokens.length === 0
      ? "\n"
      : keyedLine.tokens.map(({ token, key }) => (
          <TokenSpan key={key} token={token} />
        ))}
  </span>
);

// Types
type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code?: string;
  language: BundledLanguage | (string & {});
  showLineNumbers?: boolean;
};

interface TokenizedCode {
  tokens: ThemedToken[][];
  fg: string;
  bg: string;
}

interface AsyncTokenizedCode {
  cacheKey: string;
  tokenized: TokenizedCode;
}

interface CodeBlockContextType {
  code: string;
}

// Context
const CodeBlockContext = createContext<CodeBlockContextType>({
  code: "",
});

const shikiThemes = ["github-light", "github-dark"] satisfies BundledTheme[];
let highlighterPromise:
  | Promise<HighlighterGeneric<BundledLanguage, BundledTheme>>
  | undefined;
const languageLoadJobs = new Map<BundledLanguage, Promise<void>>();

// Token cache
const tokensCache = new Map<string, TokenizedCode>();
const tokenizationJobs = new Map<string, Promise<TokenizedCode>>();
const fallbackLanguage = "text";

// Subscribers for async token updates
const subscribers = new Map<string, Set<(result: TokenizedCode) => void>>();

const getTokensCacheKey = (code: string, language: string) => {
  const start = code.slice(0, 100);
  const end = code.length > 100 ? code.slice(-100) : "";
  return `${language}:${code.length}:${start}:${end}`;
};

type ShikiTokenLanguage = BundledLanguage | "ansi";
type ResolvedLanguage = PlainTextLanguage | ShikiTokenLanguage;

const plainTextLanguages = new Set<string>([
  "text",
  "plaintext",
  "txt",
  "plain",
]);

const isPlainTextLanguage = (language: string): language is PlainTextLanguage =>
  plainTextLanguages.has(language);

const normalizeLanguage = (language: string) =>
  (language.trim() || fallbackLanguage).toLowerCase();

const resolveLanguage = (language: string): ResolvedLanguage | null => {
  const normalizedLanguage = normalizeLanguage(language);

  if (isPlainTextLanguage(normalizedLanguage)) {
    return "text";
  }

  if (normalizedLanguage === "ansi") {
    return "ansi";
  }

  return normalizedLanguage in bundledLanguages ? (normalizedLanguage as BundledLanguage) : null;
};

const getHighlighter = () => {
  highlighterPromise ??= createHighlighter({
    langs: [],
    themes: shikiThemes,
  });

  return highlighterPromise;
};

const ensureLanguageLoaded = async (language: ShikiTokenLanguage) => {
  const highlighter = await getHighlighter();

  if (language === "ansi") {
    return highlighter;
  }

  if (highlighter.getLoadedLanguages().includes(language)) {
    return highlighter;
  }

  let languageLoadJob = languageLoadJobs.get(language);
  if (!languageLoadJob) {
    languageLoadJob = highlighter
      .loadLanguage(language)
      .then(() => undefined)
      .finally(() => {
        languageLoadJobs.delete(language);
      });
    languageLoadJobs.set(language, languageLoadJob);
  }

  await languageLoadJob;
  return highlighter;
};

// Create raw tokens for immediate display while highlighting loads
const createRawTokens = (code: string): TokenizedCode => ({
  bg: "transparent",
  fg: "inherit",
  tokens: code.split("\n").map((line) =>
    line === ""
      ? []
      : [
          {
            color: "inherit",
            content: line,
          } as ThemedToken,
        ]
  ),
});

const notifyTokenSubscribers = (tokensCacheKey: string, tokenized: TokenizedCode) => {
  const subs = subscribers.get(tokensCacheKey);
  if (!subs) {
    return;
  }

  for (const sub of subs) {
    sub(tokenized);
  }
  subscribers.delete(tokensCacheKey);
};

// Synchronous highlight with callback for async results
export const highlightCode = (
  code: string,
  language: string,
  // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-callbacks)
  callback?: (result: TokenizedCode) => void
): TokenizedCode | null => {
  const normalizedLanguage = normalizeLanguage(language);
  const tokensCacheKey = getTokensCacheKey(code, normalizedLanguage);

  // Return cached result if available
  const cached = tokensCache.get(tokensCacheKey);
  if (cached) {
    return cached;
  }

  const resolvedLanguage = resolveLanguage(language);
  if (!resolvedLanguage || isPlainTextLanguage(resolvedLanguage)) {
    const fallback = createRawTokens(code);
    tokensCache.set(tokensCacheKey, fallback);
    return fallback;
  }

  // Subscribe callback if provided
  if (callback) {
    if (!subscribers.has(tokensCacheKey)) {
      subscribers.set(tokensCacheKey, new Set());
    }
    subscribers.get(tokensCacheKey)?.add(callback);
  }

  if (tokenizationJobs.has(tokensCacheKey)) {
    return null;
  }

  // Start highlighting in background - fire-and-forget async pattern
  const tokenizationJob = ensureLanguageLoaded(resolvedLanguage)
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then)
    .then((highlighter) => {
      const availableLangs = highlighter.getLoadedLanguages();
      const langToUse =
        resolvedLanguage === "ansi" || availableLangs.includes(resolvedLanguage as BundledLanguage)
          ? resolvedLanguage
          : null;

      if (!langToUse) {
        const fallback = createRawTokens(code);
        tokensCache.set(tokensCacheKey, fallback);
        notifyTokenSubscribers(tokensCacheKey, fallback);
        return fallback;
      }

      const result = highlighter.codeToTokens(code, {
        lang: langToUse,
        themes: {
          dark: "github-dark",
          light: "github-light",
        },
      });

      const tokenized: TokenizedCode = {
        bg: result.bg ?? "transparent",
        fg: result.fg ?? "inherit",
        tokens: result.tokens,
      };

      // Cache the result
      tokensCache.set(tokensCacheKey, tokenized);
      notifyTokenSubscribers(tokensCacheKey, tokenized);

      return tokenized;
    })
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then), eslint-plugin-promise(prefer-await-to-callbacks)
    .catch((error) => {
      const fallback = createRawTokens(code);

      if (import.meta.env.DEV) {
        console.warn("Code highlighting failed; rendering plain text.", error);
      }

      tokensCache.set(tokensCacheKey, fallback);
      notifyTokenSubscribers(tokensCacheKey, fallback);

      return fallback;
    })
    // oxlint-disable-next-line eslint-plugin-promise(prefer-await-to-then)
    .finally(() => {
      tokenizationJobs.delete(tokensCacheKey);
    });

  tokenizationJobs.set(tokensCacheKey, tokenizationJob);

  return null;
};

const CodeBlockBody = memo(
  ({
    tokenized,
    showLineNumbers,
    className,
  }: {
    tokenized: TokenizedCode;
    showLineNumbers: boolean;
    className?: string;
  }) => {
    const preStyle = useMemo(
      () => ({
        backgroundColor: tokenized.bg,
        color: tokenized.fg,
      }),
      [tokenized.bg, tokenized.fg]
    );

    const keyedLines = useMemo(
      () => addKeysToTokens(tokenized.tokens),
      [tokenized.tokens]
    );

    return (
      <pre
        className={cn(
          "dark:!bg-[var(--shiki-dark-bg)] dark:!text-[var(--shiki-dark)] m-0 p-4 text-sm",
          className
        )}
        style={preStyle}
      >
        <code
          className={cn(
            "font-mono text-sm",
            showLineNumbers && "[counter-increment:line_0] [counter-reset:line]"
          )}
        >
          {keyedLines.map((keyedLine) => (
            <LineSpan
              key={keyedLine.key}
              keyedLine={keyedLine}
              showLineNumbers={showLineNumbers}
            />
          ))}
        </code>
      </pre>
    );
  },
  (prevProps, nextProps) =>
    prevProps.tokenized === nextProps.tokenized &&
    prevProps.showLineNumbers === nextProps.showLineNumbers &&
    prevProps.className === nextProps.className
);

CodeBlockBody.displayName = "CodeBlockBody";

export const CodeBlockContainer = ({
  className,
  language,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & { language: string }) => (
  <div
    className={cn(
      "group relative w-full overflow-hidden rounded-md border bg-background text-foreground",
      className
    )}
    data-language={language}
    style={{
      containIntrinsicSize: "auto 200px",
      contentVisibility: "auto",
      ...style,
    }}
    {...props}
  />
);

export const CodeBlockHeader = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-between border-b bg-muted/80 px-3 py-2 text-muted-foreground text-xs",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const CodeBlockTitle = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center gap-2", className)} {...props}>
    {children}
  </div>
);

export const CodeBlockFilename = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) => (
  <span className={cn("font-mono", className)} {...props}>
    {children}
  </span>
);

export const CodeBlockActions = ({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("-my-1 -mr-1 flex items-center gap-2", className)}
    {...props}
  >
    {children}
  </div>
);

export const CodeBlockContent = ({
  code,
  language,
  showLineNumbers = false,
}: {
  code?: string;
  language: BundledLanguage | (string & {});
  showLineNumbers?: boolean;
}) => {
  const resolvedCode = code ?? "";
  const resolvedLanguage = language || fallbackLanguage;
  const tokensCacheKey = useMemo(
    () => getTokensCacheKey(resolvedCode, resolvedLanguage),
    [resolvedCode, resolvedLanguage]
  );

  // Memoized raw tokens for immediate display
  const rawTokens = useMemo(() => createRawTokens(resolvedCode), [resolvedCode]);

  // Synchronous cache lookup — avoids setState in effect for cached results
  const syncTokens = useMemo(
    () => highlightCode(resolvedCode, resolvedLanguage) ?? rawTokens,
    [resolvedCode, resolvedLanguage, rawTokens]
  );

  // Async highlighting result (populated after shiki loads)
  const [asyncTokens, setAsyncTokens] = useState<AsyncTokenizedCode | null>(null);

  useEffect(() => {
    let cancelled = false;

    highlightCode(resolvedCode, resolvedLanguage, (result) => {
      if (!cancelled) {
        setAsyncTokens({ cacheKey: tokensCacheKey, tokenized: result });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [resolvedCode, resolvedLanguage, tokensCacheKey]);

  const tokenized = asyncTokens?.cacheKey === tokensCacheKey ? asyncTokens.tokenized : syncTokens;

  return (
    <div className="relative overflow-auto">
      <CodeBlockBody showLineNumbers={showLineNumbers} tokenized={tokenized} />
    </div>
  );
};

export const CodeBlock = ({
  code,
  language,
  showLineNumbers = false,
  className,
  children,
  ...props
}: CodeBlockProps) => {
  const resolvedCode = code ?? "";
  const contextValue = useMemo(() => ({ code: resolvedCode }), [resolvedCode]);

  return (
    <CodeBlockContext.Provider value={contextValue}>
      <CodeBlockContainer className={className} language={language} {...props}>
        {children}
        <CodeBlockContent
          code={resolvedCode}
          language={language}
          showLineNumbers={showLineNumbers}
        />
      </CodeBlockContainer>
    </CodeBlockContext.Provider>
  );
};

export type CodeBlockCopyButtonProps = ComponentProps<typeof Button> & {
  onCopy?: () => void;
  onError?: (error: Error) => void;
  timeout?: number;
};

export const CodeBlockCopyButton = ({
  onCopy,
  onError,
  timeout = 2000,
  children,
  className,
  ...props
}: CodeBlockCopyButtonProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number>(0);
  const { code } = useContext(CodeBlockContext);

  const copyToClipboard = useCallback(async () => {
    if (typeof window === "undefined" || !navigator?.clipboard?.writeText) {
      onError?.(new Error("Clipboard API not available"));
      return;
    }

    try {
      if (!isCopied) {
        await navigator.clipboard.writeText(code);
        setIsCopied(true);
        onCopy?.();
        timeoutRef.current = window.setTimeout(
          () => setIsCopied(false),
          timeout
        );
      }
    } catch (error) {
      onError?.(error as Error);
    }
  }, [code, onCopy, onError, timeout, isCopied]);

  useEffect(
    () => () => {
      window.clearTimeout(timeoutRef.current);
    },
    []
  );

  const Icon = isCopied ? CheckIcon : CopyIcon;

  return (
    <Button
      className={cn("shrink-0", className)}
      onClick={copyToClipboard}
      size="icon"
      variant="ghost"
      {...props}
    >
      {children ?? <Icon size={14} />}
    </Button>
  );
};

export type CodeBlockLanguageSelectorProps = ComponentProps<typeof Select>;

export const CodeBlockLanguageSelector = (
  props: CodeBlockLanguageSelectorProps
) => <Select {...props} />;

export type CodeBlockLanguageSelectorTriggerProps = ComponentProps<
  typeof SelectTrigger
>;

export const CodeBlockLanguageSelectorTrigger = ({
  className,
  ...props
}: CodeBlockLanguageSelectorTriggerProps) => (
  <SelectTrigger
    className={cn(
      "h-7 border-none bg-transparent px-2 text-xs shadow-none",
      className
    )}
    size="sm"
    {...props}
  />
);

export type CodeBlockLanguageSelectorValueProps = ComponentProps<
  typeof SelectValue
>;

export const CodeBlockLanguageSelectorValue = (
  props: CodeBlockLanguageSelectorValueProps
) => <SelectValue {...props} />;

export type CodeBlockLanguageSelectorContentProps = ComponentProps<
  typeof SelectContent
>;

export const CodeBlockLanguageSelectorContent = ({
  align = "end",
  ...props
}: CodeBlockLanguageSelectorContentProps) => (
  <SelectContent align={align} {...props} />
);

export type CodeBlockLanguageSelectorItemProps = ComponentProps<
  typeof SelectItem
>;

export const CodeBlockLanguageSelectorItem = (
  props: CodeBlockLanguageSelectorItemProps
) => <SelectItem {...props} />;
