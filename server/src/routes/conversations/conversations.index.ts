import { createRouter } from "@/lib/create-app";
import { authMiddleware } from "@/middlewares/auth-middleware";
import * as handlers from "./conversations.handler";
import * as routes from "./conversations.route";

const router = createRouter()
	.use(authMiddleware)
	.openapi(routes.createConversationRoute, handlers.createConversation)
	.openapi(routes.getConversationsRoute, handlers.getConversations)
	.openapi(routes.getConversationRoute, handlers.getConversation)
	.openapi(routes.updateConversationRoute, handlers.updateConversation);

export default router;
