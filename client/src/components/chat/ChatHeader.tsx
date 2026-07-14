import { Link, useNavigate } from "@tanstack/react-router";
import { Bot, Loader2, LogOut, Plus, Sparkles, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useCreateChat } from "@/queries/createChat";
import { Route as UserRoute } from "@/routes/(user)/profile";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";

interface User {
  id: string;
  name: string;
  email: string;
  profileImage?: string | null;
}

interface ChatHeaderProps {
  user: User;
  onLogout: () => void;
}

export function ChatHeader({ user, onLogout }: Readonly<ChatHeaderProps>) {
  const navigate = useNavigate();
  const { mutate: createChat, status } = useCreateChat();

  const handleNewChat = () => {
    createChat("New Chat", {
      onSuccess: (response) => {
        if (response?.id) {
          void navigate({
            to: ConversationRoute.to,
            params: { conversationId: response.id },
            search: { redirect: undefined },
          });
        }
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Couldn’t create a new chat.");
      },
    });
  };

  return (
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 py-2 sm:px-4 lg:px-6">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <SidebarTrigger
          aria-label="Open navigation sidebar"
          className="size-9 md:hidden"
          title="Open navigation sidebar"
        />
        <div aria-hidden="true" className="relative hidden sm:block">
          <div className="rounded-lg bg-primary p-2.5">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <Sparkles className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 animate-pulse text-yellow-500 motion-reduce:animate-none" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground sm:text-lg">ChatFlow</p>
          <p className="hidden truncate text-xs text-muted-foreground sm:block">
            Welcome back, <span className="font-medium">{user.name}</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <Button
          aria-label="Create a new chat"
          aria-busy={status === "pending"}
          className="text-muted-foreground"
          disabled={status === "pending"}
          onClick={handleNewChat}
          size="icon"
          title="New chat"
          type="button"
          variant="ghost"
        >
          {status === "pending" ? (
            <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          ) : (
            <Plus aria-hidden="true" className="h-4 w-4" />
          )}
        </Button>
        <ModeToggle />
        <Button asChild size="icon" variant="ghost">
          <Link aria-label="Open your profile" title="Profile" to={UserRoute.to}>
            <UserIcon aria-hidden="true" className="h-4 w-4" />
          </Link>
        </Button>

        <Button
          aria-label="Log out"
          className="text-muted-foreground"
          onClick={onLogout}
          size="icon"
          title="Log out"
          type="button"
          variant="ghost"
        >
          <LogOut aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
