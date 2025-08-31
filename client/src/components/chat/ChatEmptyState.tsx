import { useNavigate } from "@tanstack/react-router";
import { MessageSquare, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateChat } from "@/queries/createChat";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";

export function ChatEmptyState() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const { mutate: createChat, status } = useCreateChat();

  const handleCreateChat = () => {
    const chatTitle = title.trim() || "New Chat";
    createChat(chatTitle, {
      onSuccess: (response) => {
        if (response?.data?.id) {
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
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <MessageSquare className="h-6 w-6" />
          </div>
          <CardTitle>Welcome to AI Chat</CardTitle>
          <CardDescription>
            You don't have any conversations yet. Start chatting with AI to get personalized assistance and answers.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chat-title">Chat Title (Optional)</Label>
            <Input
              id="chat-title"
              placeholder="Enter a title for your chat"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={status === "pending"}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleCreateChat();
                }
              }}
            />
          </div>
          <Button onClick={handleCreateChat} className="w-full" disabled={status === "pending"}>
            <Plus className="mr-2 h-4 w-4" />
            {status === "pending" ? "Creating..." : "Start New Chat"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
