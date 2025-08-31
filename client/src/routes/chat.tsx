import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ConversationSidebar } from "@/components/chat/ConversationSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useUserLogout } from "@/composables/useLogout";
import { conversationsQuery } from "@/lib/queries";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      redirect: (search.redirect as string) || undefined,
    };
  },
  beforeLoad: ({ context, location }) => {
    // Centralized auth check for all chat routes
    if (!context.auth.isAuthenticated) {
      throw redirect({
        to: LoginRoute.to,
        search: {
          redirect: location.href,
        },
      });
    }
  },
  loader: async ({ context }) => {
    // Pre-load conversations for all chat routes
    return await context.queryClient.ensureQueryData(conversationsQuery());
  },
  component: ChatLayout,
});

function ChatLayout() {
  const { auth } = Route.useRouteContext();
  const { mutate: logout } = useUserLogout();

  if (!auth.user) {
    return <div>Loading...</div>;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="h-screen flex w-full">
        <ConversationSidebar />
        <div className="flex-1 flex flex-col">
          <ChatHeader user={auth.user} onLogout={() => logout()} />
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  );
}
