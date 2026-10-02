import { type JevQuestion, type JevRequest, JevRequestSchema, type JevResponse } from "@chat-app/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Check, CircleHelp, Download, Loader2, Play, Plus, ScanLine, Square, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { jevTemplates } from "@/components/jev/templates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getApiClient } from "@/composables/useApi";

export const Route = createFileRoute("/chat/jev")({ component: JevPage });
type DraftQuestion = { key: string; id: string; type: JevQuestion["type"]; instructions: string; criteria: string };
const draft = (q: JevQuestion): DraftQuestion => ({
  ...q,
  key: crypto.randomUUID(),
  criteria:
    q.type === "choice"
      ? Object.entries(q.criteria)
          .map(([key, value]) => `${key} | ${value}`)
          .join("\n")
      : q.type === "score"
        ? q.criteria.join("\n")
        : "",
});
const firstTemplate = jevTemplates[0];
const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring";
const percent = (value: number) => `${Math.round(value * 100)}%`;

function JevPage() {
  const api = getApiClient();
  const status = useQuery({ queryKey: ["jev", "status"], queryFn: api.jev.status, retry: false });
  const [template, setTemplate] = useState(firstTemplate?.name ?? "");
  const [state, setState] = useState(firstTemplate?.request.state ?? "");
  const [format, setFormat] = useState<"text" | "json">("text");
  const [questions, setQuestions] = useState<DraftQuestion[]>(() => firstTemplate?.request.questions.map(draft) ?? []);
  const [result, setResult] = useState<{ response: JevResponse; request: JevRequest }>();
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState("");
  const [threshold, setThreshold] = useState(0.7);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const update = (key: string, change: Partial<DraftQuestion>) =>
    setQuestions((items) => items.map((q) => (q.key === key ? { ...q, ...change } : q)));
  const loadTemplate = (name: string) => {
    const selected = jevTemplates.find((entry) => entry.name === name);
    if (!selected) return;
    setTemplate(name);
    setState(selected.request.state);
    setFormat(selected.request.stateFormat);
    setQuestions(selected.request.questions.map(draft));
    setResult(undefined);
    setError("");
    setNotice("");
  };
  const run = async () => {
    setError("");
    setNotice("");
    const parsed = JevRequestSchema.safeParse({
      state,
      stateFormat: format,
      questions: questions.map((q) => {
        const base = { id: q.id, instructions: q.instructions, type: q.type };
        const lines = q.criteria
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (q.type === "choice")
          return {
            ...base,
            criteria: Object.fromEntries(
              lines.map((line) => {
                const index = line.indexOf("|");
                return index < 0 ? [line, ""] : [line.slice(0, index).trim(), line.slice(index + 1).trim()];
              }),
            ),
          };
        if (q.type === "score") return { ...base, criteria: lines };
        return base;
      }),
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues.map((issue) => `${issue.path.join(" → ") || "Evaluation"}: ${issue.message}`).join(" "),
      );
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setRunning(true);
    setResult(undefined);
    try {
      const response = await api.jev.evaluate(parsed.data, abort.signal);
      if (!abort.signal.aborted) setResult({ response, request: parsed.data });
    } catch (failure) {
      if (abort.signal.aborted) setNotice("Evaluation cancelled. You can run it again.");
      else setError(failure instanceof Error ? failure.message : "Evaluation failed. Try again.");
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setRunning(false);
      }
    }
  };
  const download = () => {
    if (!result) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "jev-evaluation.json";
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="flex-1 overflow-y-auto bg-background" aria-label="Jev workspace">
      <div className="mx-auto max-w-7xl space-y-7 p-4 md:p-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ScanLine className="size-4" aria-hidden="true" /> TYPE SAFE · SYSTEM ONE
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">Jev Studio</h1>
            <p className="max-w-xl text-sm text-muted-foreground">
              Turn context into decisions. Classify, score and check with probabilities you can inspect.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">AI Gateway</Badge>
            <a
              className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
              href="https://vercel.com/kb/guide/typesafe-jev-and-ai-sdk"
              target="_blank"
              rel="noreferrer"
            >
              Guide <ArrowUpRight className="size-4" aria-hidden="true" />
            </a>
          </div>
        </header>
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3 text-sm"
          role="status"
        >
          <span>
            {status.isPending
              ? "Checking connection settings…"
              : status.isError
                ? "Could not check Gateway settings."
                : status.data?.configured
                  ? "Gateway key configured · ready for a live evaluation"
                  : "Ready for setup · add AI_GATEWAY_API_KEY to the server environment and restart the server."}
          </span>
          <Button size="sm" variant="ghost" onClick={() => void status.refetch()} disabled={status.isFetching}>
            Refresh connection
          </Button>
        </div>
        <section aria-label="Templates" className="grid gap-3 sm:grid-cols-3">
          {jevTemplates.map((entry) => (
            <button
              key={entry.name}
              type="button"
              disabled={running}
              aria-pressed={template === entry.name}
              onClick={() => loadTemplate(entry.name)}
              className={`rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 ${template === entry.name ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
            >
              <span className="flex items-center justify-between font-medium">
                {entry.name}
                {template === entry.name && <Check className="size-4" aria-hidden="true" />}
              </span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{entry.description}</span>
            </button>
          ))}
        </section>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <section className="min-w-0 space-y-5" aria-label="Evaluation inputs">
            <fieldset disabled={running} className="min-w-0 space-y-5 disabled:opacity-70">
              <div className="rounded-xl border p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <Label htmlFor="jev-state" className="text-base font-semibold">
                    01 / State
                  </Label>
                  <select
                    aria-label="State format"
                    className={selectClass}
                    value={format}
                    onChange={(event) => setFormat(event.target.value === "json" ? "json" : "text")}
                  >
                    <option value="text">Plain text</option>
                    <option value="json">JSON</option>
                  </select>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  The shared context every question will evaluate independently.
                </p>
                <Textarea
                  id="jev-state"
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                  maxLength={32000}
                  className="min-h-44 resize-y text-sm"
                />
                <p className="mt-2 text-right text-xs text-muted-foreground">
                  {state.length.toLocaleString()} / 32,000 characters
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold">02 / Questions</h2>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={questions.length >= 16}
                    onClick={() =>
                      setQuestions([
                        ...questions,
                        draft({ id: `question_${questions.length + 1}`, type: "boolean", instructions: "" }),
                      ])
                    }
                  >
                    <Plus className="size-4" aria-hidden="true" /> Add question
                  </Button>
                </div>
                {questions.map((q, index) => (
                  <div key={q.key} className="space-y-3 rounded-xl border p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label htmlFor={`id-${q.key}`} className="sr-only">
                        Question {index + 1} name
                      </Label>
                      <Input
                        id={`id-${q.key}`}
                        value={q.id}
                        onChange={(event) => update(q.key, { id: event.target.value })}
                        className="min-w-0 flex-1 font-mono text-sm"
                        maxLength={48}
                      />
                      <select
                        aria-label={`Question ${index + 1} type`}
                        className={selectClass}
                        value={q.type}
                        onChange={(event) => {
                          const type = event.target.value;
                          if (type === "choice" || type === "score" || type === "boolean")
                            update(q.key, {
                              type,
                              criteria:
                                type === "choice"
                                  ? "yes | Matches the criteria\nother | Does not match the criteria"
                                  : type === "score"
                                    ? "Does not meet the criteria\nPartially meets the criteria\nFully meets the criteria"
                                    : "",
                            });
                        }}
                      >
                        <option value="choice">Choice</option>
                        <option value="score">Score</option>
                        <option value="boolean">Yes / No</option>
                      </select>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Remove question ${index + 1}`}
                        disabled={questions.length <= 1}
                        onClick={() => setQuestions(questions.filter((item) => item.key !== q.key))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <Label htmlFor={`instructions-${q.key}`}>Question {index + 1}</Label>
                    <Textarea
                      id={`instructions-${q.key}`}
                      value={q.instructions}
                      onChange={(event) => update(q.key, { instructions: event.target.value })}
                      maxLength={2000}
                      className="min-h-16"
                      placeholder="Ask one specific question about the state…"
                    />
                    {q.type !== "boolean" && (
                      <>
                        <Label htmlFor={`criteria-${q.key}`}>
                          {q.type === "choice"
                            ? "Options · name | description, one per line"
                            : "Rubric · one level per line, lowest to highest"}
                        </Label>
                        <Textarea
                          id={`criteria-${q.key}`}
                          value={q.criteria}
                          onChange={(event) => update(q.key, { criteria: event.target.value })}
                          className="min-h-24 text-xs"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </fieldset>
            {error && (
              <p
                role="alert"
                className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
              >
                {error}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              {running ? (
                <>
                  <Button disabled>
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Evaluating…
                  </Button>
                  <Button variant="outline" onClick={() => controller.current?.abort()}>
                    <Square className="size-3" /> Cancel
                  </Button>
                </>
              ) : (
                <Button disabled={!status.data?.configured} onClick={() => void run()}>
                  <Play className="size-4" /> Run evaluation
                </Button>
              )}
              <span className="text-xs text-muted-foreground">{questions.length} questions · one request</span>
            </div>
            <p role="status" className="text-sm text-muted-foreground">
              {notice}
            </p>
          </section>
          <section aria-label="Evaluation results" aria-busy={running} className="min-w-0 space-y-4 xl:sticky xl:top-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">03 / Results</h2>
              {result && (
                <Button size="sm" variant="ghost" onClick={download}>
                  <Download className="size-4" /> Export
                </Button>
              )}
            </div>
            <div className="rounded-xl border bg-muted/20 p-4">
              <Label htmlFor="review-threshold">
                Review threshold <span className="font-mono">{percent(threshold)}</span>
              </Label>
              <input
                id="review-threshold"
                type="range"
                min="50"
                max="99"
                value={threshold * 100}
                onChange={(event) => setThreshold(Number(event.target.value) / 100)}
                className="mt-3 w-full accent-primary"
              />
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Choice and Score use confidence. Yes/No uses the probability of the more likely answer. This is an
                exploratory review rule, not approval to take action.
              </p>
            </div>
            {!result ? (
              <div className="flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
                <ScanLine className="mb-4 size-9 text-muted-foreground" aria-hidden="true" />
                <h3 className="font-medium">
                  {running ? "Jev is evaluating your questions" : "A decision, with the detail behind it"}
                </h3>
                <p className="mt-2 max-w-xs text-sm text-muted-foreground">
                  {running
                    ? "Results will appear together when the evaluation finishes."
                    : "Choose a template, adjust the state and run Jev to explore its answers and probability distributions."}
                </p>
              </div>
            ) : (
              <div className="space-y-4" aria-live="polite">
                <p className="text-xs text-muted-foreground">
                  {result.response.model} · {result.response.durationMs.toLocaleString()} ms ·{" "}
                  {result.response.usage.inputTokens?.toLocaleString() ?? "Unknown"} input tokens
                </p>
                {result.request.questions.map((question) => {
                  const answer = result.response.answers[question.id];
                  if (!answer) return null;
                  const certainty =
                    answer.type === "boolean"
                      ? Math.max(answer.probability, 1 - answer.probability)
                      : answer.confidence;
                  const review = certainty === undefined || certainty < threshold;
                  const bars =
                    answer.type === "boolean"
                      ? { Yes: answer.probability, No: 1 - answer.probability }
                      : answer.probabilities;
                  return (
                    <article key={question.id} className="space-y-4 rounded-xl border p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{question.id}</span>
                        <Badge variant={review ? "secondary" : "outline"}>
                          {review ? "Needs review" : "Above threshold"}
                        </Badge>
                      </div>
                      <p className="text-sm">{question.instructions}</p>
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <strong className="break-all text-2xl font-semibold">
                          {answer.type === "choice"
                            ? answer.choice
                            : answer.type === "score"
                              ? `${answer.score.toFixed(2)} / ${question.type === "score" ? question.criteria.length - 1 : "?"}`
                              : `${percent(answer.probability)} Yes`}
                        </strong>
                        {answer.type !== "boolean" && (
                          <span className="text-xs text-muted-foreground">
                            Confidence: {answer.confidence === undefined ? "unavailable" : percent(answer.confidence)}
                          </span>
                        )}
                      </div>
                      {bars ? (
                        <div className="space-y-3">
                          {Object.entries(bars).map(([key, value]) => (
                            <div key={key}>
                              <div className="mb-1 flex justify-between gap-3 text-xs">
                                <span className="min-w-0 break-words">
                                  {question.type === "score"
                                    ? `${key} · ${question.criteria[Number(key)] ?? key}`
                                    : key}
                                </span>
                                <span className="shrink-0 font-mono">{percent(value)}</span>
                              </div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                                <div
                                  className="h-full rounded-full bg-primary/70"
                                  style={{ width: `${value * 100}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">Probability distribution unavailable.</p>
                      )}
                    </article>
                  );
                })}
                <p className="text-xs text-muted-foreground">
                  Results belong to the last submitted inputs. Export includes those inputs.
                </p>
              </div>
            )}
            <div className="flex gap-2 rounded-xl border p-4 text-xs leading-relaxed text-muted-foreground">
              <CircleHelp className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                Confidence describes how concentrated a distribution is. Yes/No (TypeSafe’s Noul) estimates the
                probability that a statement is true. Neither guarantees correctness. Keep questions focused and
                validate thresholds on your own examples.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
