import { createRouter } from "@/lib/create-app";
import * as handlers from "@/routes/ai/ai.handler";
import * as routes from "@/routes/ai/ai.route";

const router = createRouter().openapi(routes.aiStream, handlers.aiStream);

export default router;
