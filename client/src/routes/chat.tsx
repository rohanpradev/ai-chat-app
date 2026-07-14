import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Suspense } from "react";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { Button } from "@/components/ui/button";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useUserLogout } from "@/composables/useLogout";
import { conversationsQuery } from "@/lib/queries";
import { redirectSearchValidator } from "@/lib/router-search";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";

export const Route = createFileRoute("/chat")({
  validateSearch: redirectSearchValidator,
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: LoginRoute.to,
        search: { redirect: location.href },
      });
    }
  },
  loader: async ({ context }) => {
    try {
      return await context.queryClient.ensureQueryData(conversationsQuery());
    } catch (error) {
      console.error("Failed to load conversations:", error);
      throw error;
    }
  },
  component: ChatLayout,
  pendingComponent: ChatLayoutPending,
  errorComponent: ChatLayoutError,
  preload: true,
  preloadStaleTime: 10_000,
});

function ChatLayoutPending() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex h-dvh items-center justify-center bg-background text-foreground"
      role="status"
    >
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        Loading chat workspace…
      </div>
    </div>
  );
}

function ChatLayoutError({ reset }: Readonly<{ reset: () => void }>) {
  const router = useRouter();

  const handleRetry = () => {
    reset();
    void router.invalidate();
  };

  return (
    <main className="flex h-dvh items-center justify-center bg-background p-4 text-foreground">
      <div className="grid w-full max-w-md justify-items-center gap-4 rounded-xl border bg-card p-6 text-center shadow-sm">
        <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle aria-hidden="true" className="size-5" />
        </div>
        <div className="grid gap-2" role="alert">
          <h1 className="text-lg font-semibold">Failed to load chat</h1>
          <p className="text-sm text-muted-foreground">We couldn’t open the chat workspace. Please try again.</p>
        </div>
        <Button onClick={handleRetry} type="button">
          <RefreshCw aria-hidden="true" className="size-4" />
          Try again
        </Button>
      </div>
    </main>
  );
}

function ChatOutletPending() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-0 flex-1 items-center justify-center bg-background"
      role="status"
    >
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-5" />
        Loading…
      </div>
    </div>
  );
}

function ChatLayout() {
  const { auth } = Route.useRouteContext();
  const { mutate: logout } = useUserLogout();

  if (!auth.user) {
    return <ChatLayoutPending />;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex h-dvh min-h-0 w-full overflow-hidden bg-background">
        <ConversationSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ChatHeader user={auth.user} onLogout={() => logout()} />
          <Suspense fallback={<ChatOutletPending />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </SidebarProvider>
  );
}
