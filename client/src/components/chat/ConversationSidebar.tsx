import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { chatsQuery } from "@/lib/queries";
import { useCreateChat } from "@/queries/createChat";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";
import type { Chat } from "@chat-app/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { MessageSquare, Plus } from "lucide-react";

export function ConversationSidebar() {
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const currentConversationId = params.conversationId;
  const { data: chats } = useSuspenseQuery(chatsQuery());
  const { mutate: createChat, status } = useCreateChat();

  const handleCreateChat = () => {
    const chatTitle = title.trim() || "New Chat";
    createChat(chatTitle, {
      onSuccess: (response) => {
        if (response?.data?.id) {
          setDialogOpen(false);
          setTitle("");
          navigate({
            to: ConversationRoute.to,
            params: { conversationId: response.data.id },
            search: { redirect: undefined },
          });
        }
      },
    });
  };

  return (
    <Sidebar variant="sidebar" className="w-64">
      <SidebarHeader>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full justify-start gap-2" variant="outline">
              <Plus className="h-4 w-4" />
              New Chat
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Create New Chat</DialogTitle>
              <DialogDescription>
                Enter a title for your new chat. Leave blank for a default title.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="title" className="text-right">
                  Title
                </Label>
                <Input
                  id="title"
                  placeholder="Enter chat title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="col-span-3"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCreateChat();
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleCreateChat}
                disabled={status === "pending"}
              >
                {status === "pending" ? "Creating..." : "Create Chat"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats?.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No chats yet</div>
              ) : (
                chats?.map((chat: Chat) => (
                  <SidebarMenuItem key={chat.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentConversationId === chat.id}
                      className="w-full justify-start gap-2"
                    >
                      <Link
                        to={ConversationRoute.to}
                        params={{ conversationId: chat.id }}
                        search={{ redirect: undefined }}
                      >
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
