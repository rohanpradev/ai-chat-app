import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCreateChat } from "@/queries/createChat";
import { Route as ConversationRoute } from "@/routes/chat/$conversationId";
import { Route as ChatIndexRoute } from "@/routes/chat/index";

export const Route = createFileRoute("/chat/new")({
  component: NewChatComponent,
});

function NewChatComponent() {
  const navigate = useNavigate();
  const { mutate: createChat, status, error } = useCreateChat();

  useEffect(() => {
    createChat("New Chat", {
      onSuccess: (response) => {
        if (response?.id) {
          navigate({
            to: ConversationRoute.to,
            params: { conversationId: response.id },
            replace: true,
          });
        } else {
          navigate({ to: ChatIndexRoute.to, replace: true });
        }
      },
      onError: () => {
        navigate({ to: ChatIndexRoute.to, replace: true });
      },
    });
  }, [createChat, navigate]);

  if (status === "pending") {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Creating new chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Failed to create chat</h2>
          <p className="text-gray-600 mb-4">{error.message}</p>
          <button
            type="button"
            onClick={() => navigate({ to: ChatIndexRoute.to, replace: true })}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return null;
}
