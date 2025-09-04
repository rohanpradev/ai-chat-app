import { createFileRoute, Outlet, redirect, useRouter } from "@tanstack/react-router";
import { Suspense } from "react";
import { z } from "zod";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useUserLogout } from "@/composables/useLogout";
import { conversationsQuery } from "@/lib/queries";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/chat")({
  validateSearch: searchSchema,
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
  // Enable automatic prefetching for better performance
  preload: "intent",
  preloadStaleTime: 10_000,
});

function ChatLayoutPending() {
  return (
    <div className="h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  );
}

function ChatLayoutError({ error }: { error: Error }) {
  const router = useRouter();

  const handleRetry = () => {
    router.invalidate();
  };

  return (
    <div className="h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-lg font-semibold mb-2">Failed to load chat</h2>
        <p className="text-gray-600 mb-4">Something went wrong. Please try again.</p>
        <button
          type="button"
          onClick={handleRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Retry
        </button>
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
      <div className="h-screen flex w-full">
        <ConversationSidebar />
        <div className="flex-1 flex flex-col">
          <ChatHeader user={auth.user} onLogout={() => logout()} />
          <Suspense fallback={<div className="flex-1 flex items-center justify-center">Loading...</div>}>
            <Outlet />
          </Suspense>
        </div>
      </div>
    </SidebarProvider>
  );
}
