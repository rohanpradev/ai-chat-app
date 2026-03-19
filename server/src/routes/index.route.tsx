import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "@/lib/create-app";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import Home from "@/routes/home.tsx";

const router = createRouter().openapi(
	createRoute({
		description:
			"Returns the API status and welcome message. Use this endpoint to verify the API is running and accessible.",
		method: "get",
		path: "/",
		responses: {
			[HttpStatusCodes.OK]: {
				description: "Successfully retrieved API status"
			}
		},
		summary: "Get API Status",
		tags: ["Base Route"]
	}),
	(c) => {
		return c.html(<Home />);
	}
);

export default router;
