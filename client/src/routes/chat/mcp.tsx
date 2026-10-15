import type { McpCapability, McpServer } from "@chat-app/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  FileText,
  Loader2,
  Plug,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getApiClient } from "@/composables/useApi";
import { useMcpRequest } from "@/hooks/useMcpRequest";
import { buildMcpDraft, mcpDraftKey } from "@/lib/mcp-draft";
import { useCreateChat } from "@/queries/createChat";

export const Route = createFileRoute("/chat/mcp")({ component: McpPage });
const icons = { tool: Wrench, resource: FileText, prompt: Sparkles };

function CapabilityDetail({ capability, server }: { capability: McpCapability; server: McpServer }) {
  const [args, setArgs] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const createChat = useCreateChat();
  const { auth } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [includePreview, setIncludePreview] = useState(false);
  const preview = useMcpRequest((argumentsJson: string, signal) =>
    getApiClient().mcp.preview(
      {
        serverId: server.id,
        action: capability.kind === "resource" ? "read" : "prompt",
        name: capability.name,
        argumentsJson,
      },
      signal,
    ),
  );
  const ready = (capability.arguments ?? []).every((argument) => !argument.required || args[argument.name]?.trim());
  const useInChat = () => {
    if (!auth.user) return;
    const userId = auth.user.id;
    const draft = buildMcpDraft({ server, capability, args, preview: includePreview ? preview.data : undefined });
    createChat.mutate(`${server.name}: ${capability.title}`.slice(0, 100), {
      onSuccess: (chat) => {
        queryClient.setQueryData(mcpDraftKey(userId, chat.id), draft);
        void navigate({
          to: "/chat/$conversationId",
          params: { conversationId: chat.id },
          search: { redirect: undefined, mcp: "1" },
        });
      },
    });
  };
  return (
    <section className="min-w-0 rounded-2xl border bg-card p-5 sm:p-6" aria-label="Capability details">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{capability.kind}</Badge>
        <span className="text-xs text-muted-foreground">{server.name}</span>
      </div>
      <h3 className="mt-4 break-words text-xl font-semibold">{capability.title}</h3>
      <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
        {capability.description || "This server did not provide a description."}
      </p>
      <p className="mt-3 break-all font-mono text-xs text-muted-foreground">{capability.name}</p>
      {capability.kind === "tool" ? (
        <>
          <div className="my-5 rounded-xl bg-muted/50 p-4 text-sm">
            <ShieldCheck className="mb-2 size-5 text-emerald-600" />
            You’ll review the exact arguments in chat before this tool runs.
          </div>
          <details className="mb-5">
            <summary className="cursor-pointer text-sm font-medium">Input schema</summary>
            <pre className="mt-3 max-h-72 overflow-auto rounded-xl bg-muted p-3 text-xs">
              {JSON.stringify(capability.inputSchema, null, 2)}
            </pre>
          </details>
        </>
      ) : (
        <div className="my-5 space-y-4">
          {(capability.arguments ?? []).map((argument) => (
            <div key={argument.name} className="space-y-2">
              <Label htmlFor={`mcp-arg-${argument.name}`}>
                {argument.name}
                {argument.required ? " (required)" : ""}
              </Label>
              <Input
                id={`mcp-arg-${argument.name}`}
                value={args[argument.name] ?? ""}
                maxLength={2000}
                disabled={preview.isPending || createChat.isPending}
                onChange={(event) => {
                  setArgs({ ...args, [argument.name]: event.target.value });
                  preview.reset();
                  setIncludePreview(false);
                }}
              />
              {argument.description && <p className="text-xs text-muted-foreground">{argument.description}</p>}
            </div>
          ))}
          <Button
            variant="outline"
            disabled={!ready || preview.isPending}
            onClick={() => {
              setIncludePreview(false);
              preview.start(JSON.stringify(args));
            }}
          >
            {preview.isPending ? (
              <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
            ) : (
              <BookOpen className="size-4" />
            )}
            {preview.isPending
              ? "Loading preview…"
              : capability.kind === "resource"
                ? "Read resource"
                : "Preview prompt"}
          </Button>
          {preview.isPending && (
            <Button variant="ghost" onClick={() => preview.cancel("Preview cancelled. You can try again.")}>
              Cancel preview
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Preview fetches content from this connection. It is displayed as text.
          </p>
        </div>
      )}
      {preview.notice && (
        <p role="status" className="mb-4 text-sm text-muted-foreground">
          {preview.notice}
        </p>
      )}
      {preview.error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {preview.error.message}
        </p>
      )}
      {preview.data?.isError && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          This connection reported an error. Its output cannot be included in a chat draft.
        </p>
      )}
      {preview.data && (
        <div className="mb-5 space-y-2" aria-live="polite">
          <p className="text-xs text-muted-foreground">
            Preview · {preview.data.durationMs} ms{preview.data.truncated ? " · truncated" : ""}
          </p>
          {!preview.data.isError && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includePreview}
                onChange={(event) => setIncludePreview(event.target.checked)}
                className="size-4 accent-primary"
              />
              Include this preview in the chat draft
            </label>
          )}
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted p-4 text-xs">
            {preview.data.text}
          </pre>
        </div>
      )}
      <Button className="w-full" onClick={useInChat} disabled={createChat.isPending || preview.isPending || !ready}>
        <Sparkles className="size-4" />
        {createChat.isPending ? "Opening…" : "Use in chat"}
        <ArrowUpRight className="ml-auto size-4" />
      </Button>
      {createChat.error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {createChat.error.message}
        </p>
      )}
    </section>
  );
}

function ConnectionExplorer({ server }: { server: McpServer }) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | McpCapability["kind"]>("all");
  const [selected, setSelected] = useState<string>();
  const inspection = useMcpRequest((_unused: undefined, signal) => getApiClient().mcp.inspect(server.id, signal));
  const capabilities = inspection.data?.capabilities ?? [];
  const filtered = capabilities.filter(
    (entry) =>
      (kind === "all" || entry.kind === kind) &&
      `${entry.title} ${entry.description} ${entry.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  const active = filtered.find((entry) => `${entry.kind}:${entry.name}` === selected) ?? filtered[0];
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">{server.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {server.description || "Explore this connection’s available capabilities."}
          </p>
          {inspection.data && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Last check succeeded · MCP {inspection.data.protocolVersion} · {inspection.data.durationMs} ms
            </p>
          )}
        </div>
        <Button
          disabled={inspection.isPending}
          onClick={() => inspection.start(undefined)}
          variant={inspection.data ? "outline" : "default"}
        >
          {inspection.isPending ? (
            <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {inspection.isPending ? "Discovering…" : inspection.data ? "Refresh capabilities" : "Discover capabilities"}
        </Button>
        {inspection.isPending && (
          <Button variant="ghost" onClick={() => inspection.cancel("Discovery cancelled. You can try again.")}>
            Cancel discovery
          </Button>
        )}
      </div>
      {inspection.notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {inspection.notice}
        </p>
      )}
      {inspection.error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
        >
          {inspection.error.message}
        </p>
      )}
      {!inspection.data && !inspection.isPending && !inspection.error && (
        <div className="rounded-2xl border border-dashed p-10 text-center">
          <Plug className="mx-auto mb-4 size-8 text-muted-foreground" />
          <h3 className="font-medium">Explore what’s possible</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Discover tools, resources, and prompts from this server. Discovery checks the connection without running a
            tool.
          </p>
        </div>
      )}
      {inspection.isPending && (
        <p role="status" className="py-8 text-center text-sm text-muted-foreground">
          Connecting and discovering capabilities…
        </p>
      )}
      {inspection.data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-48 flex-1">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input
                aria-label="Search capabilities"
                className="pl-9"
                placeholder="Find a capability: search, documents, issues…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <fieldset className="flex flex-wrap gap-1" aria-label="Capability filters">
              {(["all", "tool", "resource", "prompt"] as const).map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant={kind === value ? "secondary" : "ghost"}
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                >
                  {value === "all" ? "All" : `${value[0]?.toUpperCase()}${value.slice(1)}s`}{" "}
                  <span className="text-muted-foreground">
                    {value === "all"
                      ? capabilities.length
                      : capabilities.filter((entry) => entry.kind === value).length}
                  </span>
                </Button>
              ))}
            </fieldset>
          </div>
          {inspection.data.truncated && (
            <p className="text-sm text-muted-foreground">
              This catalog is large. Showing the first 100 entries per category; narrow the server’s catalog to see
              more.
            </p>
          )}
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              {capabilities.length
                ? "No capabilities match your search."
                : "No allowed capabilities were advertised. Check this connection’s permissions."}
            </div>
          ) : (
            <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="grid gap-2">
                {filtered.map((entry) => {
                  const Icon = icons[entry.kind];
                  const key = `${entry.kind}:${entry.name}`;
                  const isActive = active === entry;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => setSelected(key)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring ${isActive ? "border-primary/40 bg-primary/5" : "bg-card hover:bg-muted/50"}`}
                    >
                      <span className="rounded-lg border bg-background p-2">
                        <Icon className="size-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block break-words font-medium">{entry.title}</span>
                        <span className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground">
                          {entry.description || entry.name}
                        </span>
                        <span className="mt-2 block text-xs capitalize text-muted-foreground">{entry.kind}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {active && <CapabilityDetail key={`${active.kind}:${active.name}`} capability={active} server={server} />}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function McpPage() {
  const { auth } = Route.useRouteContext();
  const serversQuery = useQuery({
    queryKey: ["mcp", "servers", auth.user?.id],
    queryFn: ({ signal }) => getApiClient().mcp.servers(signal),
    enabled: Boolean(auth.user),
    retry: false,
  });
  const [selectedId, setSelectedId] = useState<string>();
  const servers = serversQuery.data?.servers ?? [];
  const selected = servers.find((server) => server.id === selectedId) ?? servers[0];
  return (
    <main className="min-h-0 flex-1 overflow-y-auto bg-gradient-to-b from-muted/30 to-background">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <Plug className="size-4" />
              Connected intelligence
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">MCP workspace</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Bring your tools and knowledge into the conversation. Explore capabilities, preview context, and turn a
              connection into useful work.
            </p>
          </div>
          <Badge variant="outline" className="gap-2 py-2">
            <ShieldCheck className="size-4 text-emerald-600" />
            Approval before action
          </Badge>
        </header>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: Wrench,
              title: "Tools that take action",
              text: "Discover on demand. Review inputs before execution.",
            },
            {
              icon: FileText,
              title: "Context you can inspect",
              text: "Read resources before bringing them into your work.",
            },
            { icon: Sparkles, title: "Reusable expertise", text: "Preview server prompts with your own arguments." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border bg-card/70 p-5">
              <Icon className="mb-3 size-5 text-primary" />
              <h2 className="text-sm font-medium">{title}</h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
        {serversQuery.isPending && <p role="status">Loading connections…</p>}
        {serversQuery.error && (
          <div role="alert" className="space-y-3 rounded-xl border p-5">
            <p>{serversQuery.error.message}</p>
            <Button variant="outline" onClick={() => void serversQuery.refetch()}>
              Try again
            </Button>
          </div>
        )}
        {serversQuery.isSuccess && !servers.length && (
          <section className="rounded-2xl border border-dashed bg-card p-8 sm:p-12">
            <Plug className="mb-5 size-10 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Your next connection starts here</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
              No MCP servers are available to your account yet. Ask your administrator to connect a trusted server and
              grant you access. Once connected, its tools, resources, and prompts will appear here.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="outline">
                <a href="https://modelcontextprotocol.io/docs/learn/architecture" target="_blank" rel="noreferrer">
                  How MCP works
                  <ArrowUpRight className="size-4" />
                </a>
              </Button>
              <Button variant="ghost" onClick={() => void serversQuery.refetch()}>
                Check again
              </Button>
            </div>
          </section>
        )}
        {selected && (
          <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
            <aside aria-label="MCP connections" className="space-y-2">
              <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Connections · {servers.length}
              </h2>
              {servers.map((server) => (
                <button
                  key={server.id}
                  type="button"
                  aria-pressed={server.id === selected.id}
                  onClick={() => setSelectedId(server.id)}
                  className={`w-full rounded-xl border p-4 text-left focus-visible:outline-2 focus-visible:outline-ring ${server.id === selected.id ? "border-primary/40 bg-primary/5" : "bg-card hover:bg-muted/50"}`}
                >
                  <span className="block break-words text-sm font-medium">{server.name}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{server.toolCount} allowed tools</span>
                </button>
              ))}
            </aside>
            <ConnectionExplorer key={selected.id} server={selected} />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Connections and access are managed by your administrator. Credentials stay on the server.
        </p>
      </div>
    </main>
  );
}
