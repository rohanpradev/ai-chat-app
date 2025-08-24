import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatSidebar } from "@/components/chat/ConversationSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useUserLogout } from "@/composables/useLogout";
import { getChatsQuery } from "@/queries/getChats";
import { Route as LoginRoute } from "@/routes/(auth)/_auth/login";

export const Route = createFileRoute("/chat")({
  beforeLoad: ({ context }) => {
    if (!context.auth.isAuthenticated) {
      throw redirect({ to: LoginRoute.to });
    }
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(getChatsQuery());
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
        <ChatSidebar />
        <div className="flex-1 flex flex-col">
          <ChatHeader user={auth.user} onLogout={() => logout()} />
          <Outlet />
        </div>
      </div>
    </SidebarProvider>
  );
}
