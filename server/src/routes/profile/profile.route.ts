import { GetProfileResponseSchema, ProfileErrorResponseSchema } from "@chat-app/shared";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { userCache } from "@/middlewares/redis-cache-middleware";

const tags = ["Profile"];

export const getUserProfile = createRoute({
	description: "Get the profile information of the authenticated user",
	method: "get",
	middleware: [authMiddleware, userCache("profile", { ttl: 1800 })],
	path: "/profile",
	responses: {
		[HttpStatusCodes.OK]: jsonContent(GetProfileResponseSchema, "Profile result"),
		[HttpStatusCodes.UNAUTHORIZED]: {
			content: {
				"application/json": {
					schema: ProfileErrorResponseSchema
				}
			},
			description: "No authentication token provided or invalid token"
		}
	},
	summary: "Get profile information",
	tags
});

export type UserProfileRoute = typeof getUserProfile;
