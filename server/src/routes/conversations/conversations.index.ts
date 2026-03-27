import { createRouter } from "@/lib/create-app";
import * as handlers from "@/routes/conversations/conversations.handler";
import * as routes from "@/routes/conversations/conversations.route";

const router = createRouter()
	.openapi(routes.createConversationRoute, handlers.createConversation)
	.openapi(routes.getConversationsRoute, handlers.getConversations)
	.openapi(routes.getConversationRoute, handlers.getConversation)
	.openapi(routes.updateConversationRoute, handlers.updateConversation);

export default router;
