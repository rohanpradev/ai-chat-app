import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Code2, Database, Rocket, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateChat } from "@/queries/createChat";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";

const CONVERSATION_STARTERS = [
  {
    description: "Design streaming chats, tool calls, message persistence, and typed UI parts.",
    icon: Sparkles,
    iconClassName: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    id: "ai-sdk-architect",
    prompt: "Help me design a production-ready AI SDK chat flow with persistence and tools",
    title: "AI SDK architect",
  },
  {
    description: "Untangle React, TypeScript, routing, forms, and frontend performance.",
    icon: Code2,
    iconClassName: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
    id: "frontend-review",
    prompt: "Review my React and TypeScript frontend for performance and code quality",
    title: "Frontend review",
  },
  {
    description: "Plan schemas, migrations, caching, and safe conversation storage.",
    icon: Database,
    iconClassName: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    id: "data-layer",
    prompt: "Help me improve a Drizzle, PostgreSQL, and Redis data layer without breaking production",
    title: "Data layer",
  },
  {
    description: "Check runtime, containers, Helm, Kubernetes rollout safety, and delivery risk.",
    icon: Rocket,
    iconClassName: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    id: "ship-it",
    prompt: "Help me harden a Bun, Docker, and Kubernetes deployment",
    title: "Ship it",
  },
] satisfies Array<{
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  id: string;
  prompt: string;
  title: string;
}>;

export function ChatEmptyState() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState("");
  const { mutate: createChat, status } = useCreateChat();
  const promptId = useId();

  const handleCreateChat = (options?: { prompt?: string; title?: string }) => {
    const message = options?.prompt?.trim() || prompt.trim();
    if (!message) {
      return;
    }

    const chatTitle = options?.title || message.slice(0, 80);
    createChat(chatTitle, {
      onSuccess: (response) => {
        if (response?.id) {
          navigate({
            to: ConversationRoute.to,
            params: { conversationId: response.id },
            search: { autoSend: "1", prompt: message, redirect: undefined },
          });
        }
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Couldn’t start the conversation.");
      },
    });
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="-top-32 -left-24 absolute h-72 w-72 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="-right-24 -bottom-24 absolute h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />

      <div className="relative w-full max-w-6xl space-y-8">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border bg-background/80 px-3 py-1.5 text-sm shadow-sm backdrop-blur">
            <Sparkles aria-hidden="true" className="size-4 text-violet-500" />
            <span className="font-medium">AI SDK 7 · TypeScript 7</span>
          </div>
          <div className="space-y-3">
            <h1 className="text-balance font-bold text-4xl tracking-tight sm:text-6xl">
              Build, debug, and ship with context.
            </h1>
          </div>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Work through AI flows, frontend polish, database safety, and delivery decisions in one focused workspace.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-center font-semibold text-2xl">What should we improve first?</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {CONVERSATION_STARTERS.map((starter) => (
              <button
                className="h-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                key={starter.id}
                onClick={() => handleCreateChat({ prompt: starter.prompt, title: starter.title })}
                type="button"
              >
                <Card className="group h-full overflow-hidden border-border/70 bg-card/85 backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-xl motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  <CardContent className="p-6">
                    <div className="flex h-full flex-col gap-5">
                      <span className={`flex size-11 items-center justify-center rounded-2xl ${starter.iconClassName}`}>
                        <starter.icon aria-hidden="true" className="size-5" />
                      </span>
                      <div className="space-y-2">
                        <h3 className="font-semibold text-xl">{starter.title}</h3>
                        <p className="text-muted-foreground text-sm leading-6">{starter.description}</p>
                      </div>
                      <span className="mt-auto flex items-center gap-1 font-medium text-sm text-primary">
                        Start this path
                        <ArrowUpRight
                          aria-hidden="true"
                          className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
                        />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        </div>

        <Card className="mx-auto max-w-xl border-border/70 bg-card/90 shadow-lg backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Or ask your own question</CardTitle>
            <CardDescription>Your first message will create and start the conversation.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={promptId}>Prompt</Label>
              <Input
                id={promptId}
                placeholder="What do you want to work on?"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={status === "pending"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateChat();
                  }
                }}
              />
            </div>
            <Button
              onClick={() => handleCreateChat()}
              className="w-full"
              disabled={status === "pending" || !prompt.trim()}
            >
              {status === "pending" ? "Starting…" : "Start conversation"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
