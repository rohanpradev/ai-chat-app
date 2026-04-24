import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateChat } from "@/queries/createChat";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";

type SvglRoute = string | { dark: string; light: string };

interface SvglLogoProps {
  alt: string;
  className?: string;
  route: SvglRoute;
}

const svgl = {
  bun: "https://svgl.app/library/bun.svg",
  docker: "https://svgl.app/library/docker.svg",
  drizzle: {
    dark: "https://svgl.app/library/drizzle-orm_dark.svg",
    light: "https://svgl.app/library/drizzle-orm_light.svg",
  },
  hono: "https://svgl.app/library/hono.svg",
  kubernetes: "https://svgl.app/library/kubernetes.svg",
  openai: {
    dark: "https://svgl.app/library/openai_dark.svg",
    light: "https://svgl.app/library/openai.svg",
  },
  postgresql: "https://svgl.app/library/postgresql.svg",
  react: {
    dark: "https://svgl.app/library/react_dark.svg",
    light: "https://svgl.app/library/react_light.svg",
  },
  redis: "https://svgl.app/library/redis.svg",
  typescript: "https://svgl.app/library/typescript.svg",
  vercel: {
    dark: "https://svgl.app/library/vercel_dark.svg",
    light: "https://svgl.app/library/vercel.svg",
  },
} satisfies Record<string, SvglRoute>;

const CONVERSATION_STARTERS = [
  {
    description: "Design streaming chats, tool calls, message persistence, and typed UI parts.",
    icons: [
      { alt: "OpenAI", route: svgl.openai },
      { alt: "Vercel", route: svgl.vercel },
    ],
    id: "ai-sdk-architect",
    prompt: "Help me design a production-ready AI SDK chat flow with persistence and tools",
    title: "AI SDK architect",
  },
  {
    description: "Untangle React, TypeScript, routing, forms, and frontend performance.",
    icons: [
      { alt: "React", route: svgl.react },
      { alt: "TypeScript", route: svgl.typescript },
    ],
    id: "frontend-review",
    prompt: "Review my React and TypeScript frontend for performance and code quality",
    title: "Frontend review",
  },
  {
    description: "Plan schemas, migrations, caching, and safe conversation storage.",
    icons: [
      { alt: "Drizzle ORM", route: svgl.drizzle },
      { alt: "PostgreSQL", route: svgl.postgresql },
      { alt: "Redis", route: svgl.redis },
    ],
    id: "data-layer",
    prompt: "Help me improve a Drizzle, PostgreSQL, and Redis data layer without breaking production",
    title: "Data layer",
  },
  {
    description: "Check runtime, containers, Helm, Kubernetes rollout safety, and delivery risk.",
    icons: [
      { alt: "Bun", route: svgl.bun },
      { alt: "Docker", route: svgl.docker },
      { alt: "Kubernetes", route: svgl.kubernetes },
    ],
    id: "ship-it",
    prompt: "Help me harden a Bun, Docker, and Kubernetes deployment",
    title: "Ship it",
  },
];

const HERO_LOGOS = [
  { alt: "OpenAI", route: svgl.openai },
  { alt: "React", route: svgl.react },
  { alt: "Hono", route: svgl.hono },
  { alt: "Drizzle ORM", route: svgl.drizzle },
  { alt: "PostgreSQL", route: svgl.postgresql },
  { alt: "Kubernetes", route: svgl.kubernetes },
];

function SvglLogo({ alt, className, route }: Readonly<SvglLogoProps>) {
  if (typeof route === "string") {
    return <img src={route} alt={alt} className={className} loading="lazy" decoding="async" />;
  }

  return (
    <>
      <img src={route.light} alt={alt} className={`${className ?? ""} dark:hidden`} loading="lazy" decoding="async" />
      <img
        src={route.dark}
        alt={alt}
        className={`${className ?? ""} hidden dark:block`}
        loading="lazy"
        decoding="async"
      />
    </>
  );
}

export function ChatEmptyState() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const { mutate: createChat, status } = useCreateChat();
  const titleId = useId();

  const handleCreateChat = (customTitle?: string) => {
    const chatTitle = customTitle || title.trim() || "New Chat";
    createChat(chatTitle, {
      onSuccess: (response) => {
        if (response?.id) {
          navigate({
            to: ConversationRoute.to,
            params: { conversationId: response.id },
            search: { redirect: undefined },
          });
        }
      },
      onError: (error) => {
        console.error("Failed to create chat:", error);
      },
    });
  };

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 sm:p-6">
      <div className="-top-32 -left-24 absolute h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
      <div className="-right-24 -bottom-24 absolute h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" />

      <div className="relative w-full max-w-6xl space-y-8">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border bg-background/80 px-3 py-2 shadow-sm backdrop-blur">
            {HERO_LOGOS.map((logo) => (
              <span key={logo.alt} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted/70 p-2">
                <SvglLogo alt={logo.alt} route={logo.route} className="h-full w-full object-contain" />
              </span>
            ))}
          </div>
          <div className="space-y-3">
            <p className="font-medium text-muted-foreground text-sm uppercase tracking-[0.35em]">
              Production AI workspace
            </p>
            <h1 className="text-balance font-bold text-4xl tracking-tight sm:text-6xl">
              Start with the stack this app actually runs.
            </h1>
          </div>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Use the assistant for AI SDK flows, frontend polish, database safety, and deployment work across the same
            tools powering this codebase.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="text-center font-semibold text-2xl">What should we improve first?</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {CONVERSATION_STARTERS.map((starter) => (
              <Card
                key={starter.id}
                className="group cursor-pointer overflow-hidden border-border/70 bg-card/85 backdrop-blur transition-all duration-200 hover:-translate-y-1 hover:border-foreground/20 hover:shadow-xl"
                onClick={() => handleCreateChat(starter.prompt)}
              >
                <CardContent className="p-6">
                  <div className="flex h-full flex-col gap-5">
                    <div className="flex items-center gap-2">
                      {starter.icons.map((icon) => (
                        <span
                          key={icon.alt}
                          className="flex h-11 w-11 items-center justify-center rounded-2xl border bg-background p-2.5 shadow-sm transition-transform group-hover:-rotate-3"
                        >
                          <SvglLogo alt={icon.alt} route={icon.route} className="h-full w-full object-contain" />
                        </span>
                      ))}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-semibold text-xl">{starter.title}</h3>
                      <p className="text-muted-foreground text-sm leading-6">{starter.description}</p>
                    </div>
                    <span className="mt-auto font-medium text-sm text-primary">Start this path -&gt;</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <Card className="mx-auto max-w-xl border-border/70 bg-card/90 shadow-lg backdrop-blur">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Or name the work yourself</CardTitle>
            <CardDescription>Create a chat with a focused title and continue from there.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={titleId}>Chat Title (Optional)</Label>
              <Input
                id={titleId}
                placeholder="Enter a title for your chat"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={status === "pending"}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateChat();
                  }
                }}
              />
            </div>
            <Button onClick={() => handleCreateChat()} className="w-full" disabled={status === "pending"}>
              {status === "pending" ? "Creating..." : "Start new chat"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
