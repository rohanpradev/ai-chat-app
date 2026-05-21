import { defaultModelId, models as fallbackModels } from "@chat-app/shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardCheck, FlaskConical, Loader2, RouteIcon, Sparkles } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";
import { Loader } from "@/components/ai-elements/loader";
import { MessageResponse } from "@/components/ai-elements/message";
import {
  Plan,
  PlanAction,
  PlanContent,
  PlanDescription,
  PlanHeader,
  PlanTitle,
  PlanTrigger,
} from "@/components/ai-elements/plan";
import {
  SchemaDisplay,
  SchemaDisplayBody,
  SchemaDisplayExample,
  SchemaDisplayHeader,
  SchemaDisplayMethod,
  SchemaDisplayPath,
} from "@/components/ai-elements/schema-display";
import { Task, TaskContent, TaskItem, TaskItemFile, TaskTrigger } from "@/components/ai-elements/task";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiRequestError } from "@/composables/useApi";
import { cn } from "@/lib/utils";
import { useEvaluateAiOutput, useGenerateAiPlan } from "@/queries/ai";
import { getAiModelsQuery } from "@/queries/getAiModels";

export const Route = createFileRoute("/chat/ai-lab")({
  component: AiLabPage,
});

const splitLines = (value: string) =>
  value
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);

const formatError = (error: unknown) => {
  if (error instanceof ApiRequestError) {
    return error.message;
  }

  return error instanceof Error ? error.message : "Request failed";
};

const planRequestBody = [
  { description: "User request to analyze and plan", name: "prompt", required: true, type: "string" },
  { description: "Background context, constraints, or source notes", name: "context", type: "string" },
  {
    description: "Target outcomes, one item per goal",
    items: { name: "goal", type: "string" },
    name: "goals",
    type: "array",
  },
  { description: "Optional chat model id", name: "model", type: "string" },
];

const planResponseBody = [
  { description: "Schema-validated task plan", name: "data", required: true, type: "AIPlanOutput" },
  {
    description: "Resolved model, provider, finish reason, and token usage",
    name: "metadata",
    required: true,
    type: "object",
  },
];

const evaluationRequestBody = [
  { description: "Original user prompt or task", name: "input", required: true, type: "string" },
  { description: "Assistant output to evaluate", name: "output", required: true, type: "string" },
  { description: "Gold answer, policy, or expected output", name: "reference", type: "string" },
  {
    description: "Evidence or retrieved source chunks",
    items: { name: "context", type: "string" },
    name: "context",
    type: "array",
  },
  { description: "Evaluation criteria", items: { name: "rubric", type: "string" }, name: "rubric", type: "array" },
  { description: "Optional judge model id", name: "model", type: "string" },
];

const evaluationResponseBody = [
  {
    description: "LLM-as-judge score, label, issues, and next action",
    name: "data",
    required: true,
    type: "AIEvaluationOutput",
  },
  {
    description: "Resolved model, provider, finish reason, and token usage",
    name: "metadata",
    required: true,
    type: "object",
  },
];

function MetadataStrip({
  metadata,
}: Readonly<{
  metadata: {
    finishReason: string;
    model: string;
    provider: string;
    usage: { inputTokens: number; outputTokens: number; totalTokens: number };
  };
}>) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge className="rounded-md" variant="outline">
        {metadata.model}
      </Badge>
      <Badge className="rounded-md" variant="secondary">
        {metadata.provider}
      </Badge>
      <Badge className="rounded-md" variant="outline">
        {metadata.finishReason}
      </Badge>
      <Badge className="rounded-md" variant="secondary">
        {metadata.usage.inputTokens} in
      </Badge>
      <Badge className="rounded-md" variant="secondary">
        {metadata.usage.outputTokens} out
      </Badge>
      <Badge className="rounded-md" variant="default">
        {metadata.usage.totalTokens} total
      </Badge>
    </div>
  );
}

function EndpointPending({ label }: Readonly<{ label: string }>) {
  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center gap-3">
        <Loader className="text-primary" size={18} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">Waiting for a schema-valid AI SDK response.</p>
        </div>
      </div>
      <Progress className="mt-4 h-1.5" value={66} />
    </div>
  );
}

function EndpointError({ error }: Readonly<{ error: unknown }>) {
  return (
    <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
      {formatError(error)}
    </p>
  );
}

function PlanResult({ result }: Readonly<{ result: NonNullable<ReturnType<typeof useGenerateAiPlan>["data"]> }>) {
  const plan = result.data;

  return (
    <Plan className="rounded-lg" defaultOpen>
      <PlanHeader>
        <div className="grid gap-1">
          <PlanTitle>{plan.title}</PlanTitle>
          <PlanDescription>{plan.intent}</PlanDescription>
        </div>
        <PlanAction>
          <PlanTrigger />
        </PlanAction>
      </PlanHeader>
      <PlanContent className="grid gap-5">
        <MetadataStrip metadata={result.metadata} />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Agent</p>
            <p className="mt-1 text-sm font-medium">{plan.recommendedAgentMode}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Model</p>
            <p className="mt-1 text-sm font-medium">{plan.recommendedModel}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Freshness</p>
            <p className="mt-1 text-sm font-medium">{plan.needsFreshness ? "Required" : "Not required"}</p>
          </div>
        </div>

        <div className="grid gap-3">
          {plan.steps.map((step, index) => (
            <Task defaultOpen={index === 0} key={`${step.title}:${step.action}:${step.expectedOutput}`}>
              <TaskTrigger title={`${index + 1}. ${step.title}`} />
              <TaskContent>
                <TaskItem>{step.action}</TaskItem>
                <TaskItemFile>{step.expectedOutput}</TaskItemFile>
              </TaskContent>
            </Task>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-2">
            <p className="text-sm font-medium">Evaluation checklist</p>
            {plan.evaluationChecklist.map((item) => (
              <div className="flex gap-2 text-sm" key={item}>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="grid content-start gap-2">
            <p className="text-sm font-medium">Risks</p>
            {plan.risks.length === 0 ? <p className="text-sm text-muted-foreground">No risks returned.</p> : null}
            {plan.risks.map((risk) => (
              <div className="rounded-md border p-3 text-sm" key={risk.risk}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{risk.risk}</span>
                  <Badge className="rounded-md" variant={risk.severity === "high" ? "destructive" : "outline"}>
                    {risk.severity}
                  </Badge>
                </div>
                <p className="mt-1 text-muted-foreground">{risk.mitigation}</p>
              </div>
            ))}
          </div>
        </div>
      </PlanContent>
    </Plan>
  );
}

function EvaluationResult({
  result,
}: Readonly<{ result: NonNullable<ReturnType<typeof useEvaluateAiOutput>["data"]> }>) {
  const evaluation = result.data;
  const scorePercent = Math.round(evaluation.score * 100);

  return (
    <Card className="rounded-lg">
      <CardHeader>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4" />
              Evaluation Result
            </CardTitle>
            <CardDescription>{evaluation.hallucinationRisk} hallucination risk</CardDescription>
          </div>
          <Badge
            className="rounded-md"
            variant={evaluation.label === "pass" ? "default" : evaluation.label === "fail" ? "destructive" : "outline"}
          >
            {evaluation.label.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5">
        <MetadataStrip metadata={result.metadata} />

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="font-medium">Score</span>
            <span className="text-muted-foreground">{scorePercent}%</span>
          </div>
          <Progress value={scorePercent} />
        </div>

        <div className="rounded-md border bg-muted/25 p-4">
          <MessageResponse className="prose prose-sm dark:prose-invert max-w-none break-words text-sm leading-6">
            {evaluation.finalRecommendation}
          </MessageResponse>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="grid content-start gap-2">
            <p className="text-sm font-medium">Strengths</p>
            {evaluation.strengths.map((strength) => (
              <div className="flex gap-2 text-sm" key={strength}>
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{strength}</span>
              </div>
            ))}
          </div>

          <div className="grid content-start gap-2">
            <p className="text-sm font-medium">Issues</p>
            {evaluation.issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No issues returned.</p>
            ) : null}
            {evaluation.issues.map((issue) => (
              <div className="rounded-md border p-3 text-sm" key={`${issue.category}-${issue.description}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{issue.category.replace("_", " ")}</span>
                  <Badge className="rounded-md" variant={issue.severity === "high" ? "destructive" : "outline"}>
                    {issue.severity}
                  </Badge>
                </div>
                <p className="mt-1">{issue.description}</p>
                <p className="mt-1 text-muted-foreground">{issue.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EndpointSchemaCards() {
  return (
    <div className="grid gap-4">
      <SchemaDisplay
        description="Converts a prompt into a typed execution plan, recommended agent mode, tool list, risks, and checks."
        method="POST"
        path="/api/ai/plan"
        requestBody={planRequestBody}
        responseBody={planResponseBody}
      />
      <SchemaDisplay
        description="Runs a typed LLM-as-judge evaluation over an input/output pair with optional evidence and rubric."
        method="POST"
        path="/api/ai/evaluate"
        requestBody={evaluationRequestBody}
        responseBody={evaluationResponseBody}
      />
    </div>
  );
}

function PayloadPreview({ value }: Readonly<{ value: unknown }>) {
  return (
    <SchemaDisplay method="POST" path="response.payload">
      <SchemaDisplayHeader>
        <div className="flex items-center gap-3">
          <SchemaDisplayMethod>JSON</SchemaDisplayMethod>
          <SchemaDisplayPath />
        </div>
      </SchemaDisplayHeader>
      <SchemaDisplayBody>
        <SchemaDisplayExample className="m-0 max-h-96 rounded-none border-0 bg-muted/25">
          {JSON.stringify(value, null, 2)}
        </SchemaDisplayExample>
      </SchemaDisplayBody>
    </SchemaDisplay>
  );
}

function AiLabPage() {
  const [model, setModel] = useState(defaultModelId);
  const [planPrompt, setPlanPrompt] = useState("Add a production-grade RAG workflow with citations and eval checks.");
  const [planContext, setPlanContext] = useState("Bun workspace, Hono API, React client, Vercel AI SDK agents.");
  const [planGoals, setPlanGoals] = useState(
    "Use existing shared schemas\nKeep tool use approval-gated\nExpose a UI to test the endpoint",
  );
  const [evaluationInput, setEvaluationInput] = useState("Explain how the AI Lab endpoints should be tested.");
  const [evaluationOutput, setEvaluationOutput] = useState(
    "Use the AI Lab page to submit plan and evaluation requests, inspect typed JSON, and check token metadata.",
  );
  const [evaluationReference, setEvaluationReference] = useState(
    "A complete answer mentions both /api/ai/plan and /api/ai/evaluate and includes UI verification.",
  );
  const [evaluationRubric, setEvaluationRubric] = useState(
    "Grounded in available UI\nActionable for a developer\nNo unsupported claims",
  );

  const modelsQuery = useQuery(getAiModelsQuery());
  const planMutation = useGenerateAiPlan();
  const evaluationMutation = useEvaluateAiOutput();
  const availableModels = modelsQuery.data && modelsQuery.data.length > 0 ? modelsQuery.data : fallbackModels;

  const handlePlanSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const prompt = planPrompt.trim();

    if (!prompt) {
      return;
    }

    const goals = splitLines(planGoals);
    planMutation.mutate({
      ...(planContext.trim() ? { context: planContext.trim() } : {}),
      ...(goals.length > 0 ? { goals } : {}),
      model,
      prompt,
    });
  };

  const handleEvaluationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const input = evaluationInput.trim();
    const output = evaluationOutput.trim();

    if (!input || !output) {
      return;
    }

    const rubric = splitLines(evaluationRubric);
    evaluationMutation.mutate({
      ...(evaluationReference.trim() ? { reference: evaluationReference.trim() } : {}),
      ...(rubric.length > 0 ? { rubric } : {}),
      input,
      model,
      output,
    });
  };

  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto grid w-full max-w-7xl gap-5 p-4 md:p-6">
        <div className="flex flex-col gap-2 border-b pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">AI Lab</h1>
            <p className="text-sm text-muted-foreground">
              Structured planning and LLM-as-judge endpoints with live UI payloads.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge className="rounded-md" variant="secondary">
              AI SDK agents
            </Badge>
            <Badge className="rounded-md" variant="outline">
              Structured output
            </Badge>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <section className="grid content-start gap-4">
            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4" />
                  Plan Endpoint
                </CardTitle>
                <CardDescription>POST /api/ai/plan</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handlePlanSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="ai-lab-model">Model</Label>
                    <Select disabled={modelsQuery.isLoading} onValueChange={setModel} value={model}>
                      <SelectTrigger id="ai-lab-model">
                        <SelectValue placeholder="Model" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableModels.map((modelOption) => (
                          <SelectItem key={modelOption.id} value={modelOption.id}>
                            {modelOption.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ai-plan-prompt">Prompt</Label>
                    <Textarea
                      className="min-h-28 resize-y"
                      id="ai-plan-prompt"
                      onChange={(event) => setPlanPrompt(event.target.value)}
                      value={planPrompt}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ai-plan-context">Context</Label>
                    <Textarea
                      className="min-h-24 resize-y"
                      id="ai-plan-context"
                      onChange={(event) => setPlanContext(event.target.value)}
                      value={planContext}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ai-plan-goals">Goals</Label>
                    <Textarea
                      className="min-h-24 resize-y"
                      id="ai-plan-goals"
                      onChange={(event) => setPlanGoals(event.target.value)}
                      value={planGoals}
                    />
                  </div>

                  <Button disabled={!planPrompt.trim() || planMutation.isPending} type="submit">
                    {planMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <RouteIcon className="size-4" />
                    )}
                    Generate plan
                  </Button>
                </form>
              </CardContent>
            </Card>

            <Card className="rounded-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardCheck className="size-4" />
                  Evaluate Endpoint
                </CardTitle>
                <CardDescription>POST /api/ai/evaluate</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-3" onSubmit={handleEvaluationSubmit}>
                  <div className="grid gap-2">
                    <Label htmlFor="ai-eval-input">Input</Label>
                    <Textarea
                      className="min-h-24 resize-y"
                      id="ai-eval-input"
                      onChange={(event) => setEvaluationInput(event.target.value)}
                      value={evaluationInput}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ai-eval-output">Output</Label>
                    <Textarea
                      className="min-h-28 resize-y"
                      id="ai-eval-output"
                      onChange={(event) => setEvaluationOutput(event.target.value)}
                      value={evaluationOutput}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ai-eval-reference">Reference</Label>
                    <Textarea
                      className="min-h-20 resize-y"
                      id="ai-eval-reference"
                      onChange={(event) => setEvaluationReference(event.target.value)}
                      value={evaluationReference}
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="ai-eval-rubric">Rubric</Label>
                    <Textarea
                      className="min-h-20 resize-y"
                      id="ai-eval-rubric"
                      onChange={(event) => setEvaluationRubric(event.target.value)}
                      value={evaluationRubric}
                    />
                  </div>

                  <Button
                    disabled={!evaluationInput.trim() || !evaluationOutput.trim() || evaluationMutation.isPending}
                    type="submit"
                  >
                    {evaluationMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <FlaskConical className="size-4" />
                    )}
                    Run judge
                  </Button>
                </form>
              </CardContent>
            </Card>
          </section>

          <section className="grid content-start gap-4">
            {planMutation.isPending ? <EndpointPending label="Generating structured plan" /> : null}
            {planMutation.error ? <EndpointError error={planMutation.error} /> : null}
            {planMutation.data ? <PlanResult result={planMutation.data} /> : null}
            {planMutation.data ? <PayloadPreview value={planMutation.data} /> : null}

            {evaluationMutation.isPending ? <EndpointPending label="Running LLM-as-judge evaluation" /> : null}
            {evaluationMutation.error ? <EndpointError error={evaluationMutation.error} /> : null}
            {evaluationMutation.data ? <EvaluationResult result={evaluationMutation.data} /> : null}
            {evaluationMutation.data ? <PayloadPreview value={evaluationMutation.data} /> : null}

            <div className={cn("grid gap-4", (planMutation.data || evaluationMutation.data) && "pt-2")}>
              <EndpointSchemaCards />
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
