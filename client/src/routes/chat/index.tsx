import { createFileRoute } from "@tanstack/react-router";
import { ChatEmptyState } from "@/components/chat/ChatEmptyState";

export const Route = createFileRoute("/chat/")({
  component: ChatIndexPage,
});

function ChatIndexPage() {
  // Auth and data loading is handled by parent /chat route
  // No need for additional loader here since conversations are already loaded
  return (
    <main className="min-h-0 flex-1 overflow-y-auto">
      <ChatEmptyState />
    </main>
  );
}
