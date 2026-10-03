import {
	CommonErrorResponseSchema,
	JEV_MODEL_ID,
	JevRequestSchema,
	JevResponseSchema,
	JevStatusSchema
} from "@chat-app/shared";
import { createRoute } from "@hono/zod-openapi";
import { bodyLimit } from "hono/body-limit";
import { createRouter } from "@/lib/create-app";
import { asRouteMiddleware } from "@/lib/hono-compat";
import { jsonBody, jsonContent } from "@/lib/openapi";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { aiRateLimit } from "@/middlewares/rate-limit";
import { createJevService, JevServiceError } from "@/services/jev.service";
import { reserveUsage, settleUsage } from "@/services/usage.service";
import env from "@/utils/env";

const service = createJevService({ apiKey: env.AI_GATEWAY_API_KEY, reserveUsage, settleUsage });
const authenticated = asRouteMiddleware(authMiddleware);
const error = jsonContent(CommonErrorResponseSchema, "Evaluation unavailable or invalid request");
const router = createRouter()
	.openapi(
		createRoute({
			method: "get",
			middleware: [authenticated],
			path: "/jev/status",
			responses: {
				200: jsonContent(JevStatusSchema, "Gateway configuration status; does not test credentials"),
				401: error
			},
			security: [{ CookieAuth: [] }],
			tags: ["Jev"]
		}),
		(c) => c.json({ configured: Boolean(env.AI_GATEWAY_API_KEY), model: JEV_MODEL_ID } as const, 200)
	)
	.openapi(
		createRoute({
			method: "post",
			middleware: [
				authenticated,
				asRouteMiddleware(aiRateLimit),
				asRouteMiddleware(
					bodyLimit({ maxSize: 256000, onError: (c) => c.json({ message: "Evaluation request is too large." }, 413) })
				)
			],
			path: "/jev/evaluate",
			request: { body: jsonBody(JevRequestSchema, "State and independent typed questions") },
			responses: {
				200: jsonContent(JevResponseSchema, "Typed Jev answers"),
				400: error,
				401: error,
				408: error,
				413: error,
				429: error,
				502: error,
				503: error,
				504: error
			},
			security: [{ CookieAuth: [] }],
			tags: ["Jev"]
		}),
		async (c) => {
			try {
				return c.json(await service.evaluate(c.req.valid("json"), c.get("jwtPayload").sub.id, c.req.raw.signal), 200);
			} catch (error) {
				if (error instanceof JevServiceError) return c.json({ message: error.message }, error.status);
				throw error;
			}
		}
	);
export default router;
