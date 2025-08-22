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
import { conversationsQuery } from "@/lib/queries";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";
import { Route as NewChatRoute } from "@/routes/chat/new";

export function ConversationSidebar() {
  const params = useParams({ strict: false });
  const currentConversationId = params.conversationId;
  const { data: conversationsData } = useSuspenseQuery(conversationsQuery());
  const conversations = conversationsData?.data || [];

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
          <SidebarGroupLabel>Conversations</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {conversations?.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No conversations yet</div>
              ) : (
                conversations?.map((conversation) => (
                  <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentConversationId === conversation.id}
                      className="w-full justify-start gap-2"
                    >
                      <Link to={ConversationRoute.to} params={{ conversationId: conversation.id }}>
                        <MessageSquare className="h-4 w-4" />
                        <span className="truncate">{conversation.title || "Untitled Chat"}</span>
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
