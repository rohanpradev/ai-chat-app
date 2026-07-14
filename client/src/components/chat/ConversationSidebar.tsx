import type { Chat } from "@chat-app/shared";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useRouterState } from "@tanstack/react-router";
import { Database, FlaskConical, MessageSquare, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
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
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useCreateChat } from "@/queries/createChat";
import { useDeleteChat } from "@/queries/deleteChat";
import { getChatsQuery } from "@/queries/getChats";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";
import { Route as AiLabRoute } from "@/routes/chat/ai-lab";
import { Route as EmbeddingsRoute } from "@/routes/chat/embeddings";
import { Route as ChatIndexRoute } from "@/routes/chat/index";

export function ConversationSidebar() {
  const params = useParams({ strict: false });
  const navigate = useNavigate();
  const titleId = useId();
  const [title, setTitle] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Chat | null>(null);
  const { isMobile, setOpenMobile } = useSidebar();
  const currentConversationId = params.conversationId;
  const currentPath = useRouterState({ select: (state) => state.location.pathname });
  const { data: chats } = useSuspenseQuery(getChatsQuery());
  const { error, mutate: createChat, status } = useCreateChat();
  const deleteChat = useDeleteChat();

  const closeMobileSidebar = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleCreateChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const chatTitle = title.trim() || "New Chat";
    createChat(chatTitle, {
      onSuccess: (response) => {
        setDialogOpen(false);
        setTitle("");
        closeMobileSidebar();

        void navigate({
          to: ConversationRoute.to,
          params: { conversationId: response.id },
          search: { redirect: undefined },
        });
      },
    });
  };

  const handleDeleteChat = () => {
    if (!pendingDelete) {
      return;
    }

    deleteChat.mutate(pendingDelete.id, {
      onSuccess: () => {
        const deletedCurrentConversation = currentConversationId === pendingDelete.id;
        setPendingDelete(null);
        closeMobileSidebar();

        if (deletedCurrentConversation) {
          void navigate({ to: ChatIndexRoute.to, search: { redirect: undefined } });
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
              <DialogDescription>Enter a title for your new chat. Leave blank for a default title.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={handleCreateChat}>
              <div className="grid gap-2 py-2 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-4">
                <Label htmlFor={titleId}>Title</Label>
                <Input
                  autoComplete="off"
                  disabled={status === "pending"}
                  id={titleId}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Enter chat title"
                  value={title}
                />
              </div>
              {error ? (
                <p className="text-sm text-destructive" role="alert">
                  {error instanceof Error ? error.message : "Couldn’t create the chat."}
                </p>
              ) : null}
              <DialogFooter>
                <Button aria-busy={status === "pending"} disabled={status === "pending"} type="submit">
                  {status === "pending" ? "Creating…" : "Create chat"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </SidebarHeader>

      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open && !deleteChat.isPending) {
            setPendingDelete(null);
            deleteChat.reset();
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete conversation?</DialogTitle>
            <DialogDescription>
              “{pendingDelete?.title || "Untitled chat"}” and all of its messages will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          {deleteChat.error ? (
            <p className="text-sm text-destructive" role="alert">
              {deleteChat.error instanceof Error ? deleteChat.error.message : "Couldn’t delete the conversation."}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              disabled={deleteChat.isPending}
              onClick={() => setPendingDelete(null)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={deleteChat.isPending} onClick={handleDeleteChat} type="button" variant="destructive">
              {deleteChat.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Knowledge</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={currentPath === EmbeddingsRoute.to}
                  className="w-full justify-start gap-2"
                >
                  <Link onClick={closeMobileSidebar} to={EmbeddingsRoute.to} search={{ redirect: undefined }}>
                    <Database aria-hidden="true" className="h-4 w-4" />
                    <span className="truncate">Embedding</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={currentPath === AiLabRoute.to}
                  className="w-full justify-start gap-2"
                >
                  <Link onClick={closeMobileSidebar} to={AiLabRoute.to} search={{ redirect: undefined }}>
                    <FlaskConical aria-hidden="true" className="h-4 w-4" />
                    <span className="truncate">AI Lab</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.length === 0 ? (
                <div className="p-4 text-center space-y-2">
                  <MessageSquare aria-hidden="true" className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">No chats yet</p>
                  <p className="text-xs text-muted-foreground">Create your first chat to get started</p>
                </div>
              ) : (
                chats.map((conversation: Chat) => (
                  <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={currentConversationId === conversation.id}
                      className="w-full justify-start gap-2"
                    >
                      <Link
                        to={ConversationRoute.to}
                        params={{ conversationId: conversation.id }}
                        search={{ redirect: undefined }}
                        onClick={closeMobileSidebar}
                        title={conversation.title || "Untitled chat"}
                      >
                        <MessageSquare aria-hidden="true" className="h-4 w-4" />
                        <span className="truncate">{conversation.title || "Untitled Chat"}</span>
                      </Link>
                    </SidebarMenuButton>
                    <SidebarMenuAction
                      aria-label={`Delete ${conversation.title || "Untitled chat"}`}
                      onClick={() => {
                        deleteChat.reset();
                        setPendingDelete(conversation);
                      }}
                      showOnHover
                      title="Delete conversation"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" />
                    </SidebarMenuAction>
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
