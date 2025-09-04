import { useNavigate } from "@tanstack/react-router";
import { MessageSquare, Plus, Sparkles, Code, BookOpen, Lightbulb } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateChat } from "@/queries/createChat";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";

const CONVERSATION_STARTERS = [
  {
    icon: Code,
    title: "Code Helper",
    description: "Get help with programming and debugging",
    prompt: "Help me with coding"
  },
  {
    icon: BookOpen,
    title: "Learning Assistant",
    description: "Explain concepts and answer questions",
    prompt: "Explain a concept to me"
  },
  {
    icon: Lightbulb,
    title: "Creative Ideas",
    description: "Brainstorm and generate creative solutions",
    prompt: "Help me brainstorm ideas"
  },
  {
    icon: Sparkles,
    title: "General Chat",
    description: "Have a conversation about anything",
    prompt: "Let's have a conversation"
  }
];

export function ChatEmptyState() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const { mutate: createChat, status } = useCreateChat();
  const titleId = useId();

  const handleCreateChat = (customTitle?: string) => {
    const chatTitle = customTitle || title.trim() || "New Chat";
    createChat(chatTitle, {
      onSuccess: (response) => {
        if (response?.id) {
          navigate({
            to: ConversationRoute.to,
            params: { conversationId: response.id },
            search: { redirect: undefined },
          });
        }
      },
      onError: (error) => {
        console.error("Failed to create chat:", error);
      },
    });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-8">
        {/* Welcome Section */}
        <div className="text-center space-y-4">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Welcome to AI Chat</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Your intelligent conversation partner. Get help with coding, learning, creative projects, or just have a friendly chat.
          </p>
        </div>

        {/* Conversation Starters */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-center">How can I help you today?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CONVERSATION_STARTERS.map((starter, index) => {
              const Icon = starter.icon;
              return (
                <Card 
                  key={index} 
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105"
                  onClick={() => handleCreateChat(starter.prompt)}
                >
                  <CardContent className="p-6">
                    <div className="flex items-start space-x-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold">{starter.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{starter.description}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Custom Chat Creation */}
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="text-lg">Or start a custom chat</CardTitle>
            <CardDescription>
              Create a chat with your own title
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={titleId}>Chat Title (Optional)</Label>
              <Input
                id={titleId}
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
            <Button onClick={() => handleCreateChat()} className="w-full" disabled={status === "pending"}>
              <Plus className="mr-2 h-4 w-4" />
              {status === "pending" ? "Creating..." : "Start New Chat"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
