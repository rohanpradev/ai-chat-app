import { createRouter } from "@/lib/create-app";
import * as handlers from "@/routes/chat/chat.handler";
import * as routes from "@/routes/chat/chat.route";

const router = createRouter()
	.openapi(routes.getChatRoute, handlers.getChatHandler)
	.openapi(routes.getChatsRoute, handlers.getChatsHandler)
	.openapi(routes.upsertChatRoute, handlers.upsertChatHandler);

export default router;
