import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getChatsQuery } from "@/queries/getChats";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";
import { Route as NewChatRoute } from "@/routes/chat/new";

export function ChatSidebar() {
  const params = useParams({ strict: false });
  const currentConversationId = params.conversationId;
  const { data: chatsData } = useSuspenseQuery(getChatsQuery());
  const chats = chatsData?.data || [];

  return (
    <Sidebar variant="sidebar" className="w-64">
      <SidebarHeader>
        <Button asChild className="w-full justify-start gap-2" variant="outline">
          <Link to={NewChatRoute.to}>
            <Plus className="h-4 w-4" />
            New Chat
          </Link>
        </Button>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats?.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No chats yet</div>
              ) : (
                chats?.map((chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentConversationId === chat.id}
                      className="w-full justify-start gap-2"
                    >
                      <Link to={ConversationRoute.to} params={{ conversationId: chat.id }}>
                        <MessageSquare className="h-4 w-4" />
                        <span className="truncate">{chat.title || "Untitled Chat"}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
