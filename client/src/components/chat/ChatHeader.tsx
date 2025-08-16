import { Link } from "@tanstack/react-router";
import { Bot, LogOut, Sparkles, Trash2, User as UserIcon } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import { Route as UserRoute } from "@/routes/(user)/profile";

interface User {
  id: string;
  name: string;
  email: string;
  profileImage?: string | null;
}

interface ChatHeaderProps {
  user: User;
  messagesCount: number;
  onClearChat: () => void;
  onLogout: () => void;
}

export function ChatHeader({ user, messagesCount, onClearChat, onLogout }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-card border-b border-border">
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="bg-primary p-2.5 rounded-lg">
            <Bot className="h-5 w-5 text-primary-foreground" />
          </div>
          <Sparkles className="h-2.5 w-2.5 text-yellow-500 absolute -top-0.5 -right-0.5 animate-pulse" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-foreground">ChatFlow</h1>
          <p className="text-xs text-muted-foreground">
            Welcome back, <span className="font-medium">{user?.name}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <ModeToggle />
        <Button variant="ghost" size="sm" asChild>
          <Link to={UserRoute.to}>
            <UserIcon className="h-4 w-4" />
          </Link>
        </Button>
        {messagesCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearChat}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground">
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
