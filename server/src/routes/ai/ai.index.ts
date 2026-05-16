import { createRouter } from "@/lib/create-app";
import * as handlers from "@/routes/ai/ai.handler";
import * as routes from "@/routes/ai/ai.route";

const router = createRouter()
	.openapi(routes.getAvailableModels, handlers.getAvailableModels)
	.openapi(routes.generatePlan, handlers.generatePlan)
	.openapi(routes.evaluateOutput, handlers.evaluateOutput)
	.openapi(routes.aiStream, handlers.aiStream);

export default router;
