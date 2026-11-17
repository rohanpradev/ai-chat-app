import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useCreateChat } from "@/queries/createChat";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";
import { Route as ChatIndexRoute } from "@/routes/chat/index";

export const Route = createFileRoute("/chat/new")({
  component: NewChatComponent,
});

function NewChatComponent() {
  const navigate = useNavigate();
  const { mutate: createChat, isError } = useCreateChat();
  const hasStartedCreateRef = useRef(false);

  const startCreate = useCallback(() => {
    createChat("New Chat", {
      onSuccess: ({ id }) => {
        void navigate({ to: ConversationRoute.to, params: { conversationId: id }, replace: true });
      },
    });
  }, [createChat, navigate]);

  useEffect(() => {
    if (hasStartedCreateRef.current) {
      return;
    }
    hasStartedCreateRef.current = true;
    startCreate();
  }, [startCreate]);

  if (!isError) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground" role="status">
        <Spinner aria-hidden="true" />
        <span>Creating new chat…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="space-y-3 text-center">
        <div role="alert">
          <h2 className="text-lg font-semibold">Failed to create chat</h2>
        </div>
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => void navigate({ to: ChatIndexRoute.to, replace: true })}
            type="button"
            variant="outline"
          >
            Go back
          </Button>
          <Button onClick={startCreate} type="button">
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}
