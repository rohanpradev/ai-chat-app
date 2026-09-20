import { useNavigate } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, Code2, Database, Rocket, Sparkles } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { BrandMark } from "@/components/ui/brand-mark";
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
    if (!message || status === "pending") {
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
    <main className="flex min-h-0 flex-1 overflow-y-auto bg-muted/15">
      <div className="mx-auto my-auto w-full max-w-4xl px-5 py-10 sm:px-10 sm:py-16">
        <div className="mb-8 space-y-4 sm:mb-10">
          <div className="flex items-center gap-3">
            <BrandMark className="size-9" />
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Your thinking space
            </span>
          </div>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">What’s on your mind?</h1>
          <p className="max-w-xl text-base leading-7 text-muted-foreground">
            Work through an idea, find an answer, or make your next move.
          </p>
        </div>

        <PromptInput
          onSubmit={() => handleCreateChat()}
          className="[&>[data-slot=input-group]]:rounded-3xl [&>[data-slot=input-group]]:border-border/70 [&>[data-slot=input-group]]:bg-background [&>[data-slot=input-group]]:shadow-sm"
        >
          <PromptInputBody>
            <Label className="sr-only" htmlFor={promptId}>
              Prompt
            </Label>
            <PromptInputTextarea
              id={promptId}
              aria-label="Prompt"
              className="min-h-28 px-5 pt-5 text-base"
              placeholder="Ask a question or describe what you’re working on…"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              disabled={status === "pending"}
            />
          </PromptInputBody>
          <PromptInputFooter className="px-4 pb-4">
            <span className="text-xs text-muted-foreground">A fresh conversation starts here.</span>
            <PromptInputSubmit
              aria-label="Start conversation"
              disabled={status === "pending" || !prompt.trim()}
              status={status === "pending" ? "submitted" : "ready"}
              className="size-9 rounded-full"
            />
          </PromptInputFooter>
        </PromptInput>

        <section className="mt-9" aria-labelledby="conversation-starters">
          <h2
            id="conversation-starters"
            className="mb-4 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground"
          >
            A place to start
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {CONVERSATION_STARTERS.map((starter) => (
              <button
                className="group flex items-start gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 text-left transition-colors hover:border-primary/35 hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none"
                key={starter.id}
                disabled={status === "pending"}
                onClick={() => handleCreateChat({ prompt: starter.prompt, title: starter.title })}
                type="button"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${starter.iconClassName}`}
                >
                  <starter.icon aria-hidden="true" className="size-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <h3 className="text-sm font-medium">{starter.title}</h3>
                  <p className="text-xs leading-5 text-muted-foreground">{starter.description}</p>
                </div>
                <ArrowUpRight
                  aria-hidden="true"
                  className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                />
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
