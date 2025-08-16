import { createRouter } from "@/lib/create-app";
import * as handlers from "@/routes/auth/auth.handler";
import * as routes from "@/routes/auth/auth.route";

const router = createRouter()
	.openapi(routes.registerUser, handlers.registerUser)
	.openapi(routes.loginUser, handlers.loginUser)
	.openapi(routes.me, handlers.getMe)
	.openapi(routes.logoutUser, handlers.logoutUser);

export default router;
