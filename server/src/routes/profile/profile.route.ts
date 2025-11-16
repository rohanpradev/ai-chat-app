import {
	BadRequestResponseSchema,
	GetProfileResponseSchema,
	ProfileErrorResponseSchema,
	UpdateProfileRequestSchema,
	UpdateProfileResponseSchema
} from "@chat-app/shared";
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

export const updateUserProfile = createRoute({
	description: "Update the profile information of the authenticated user",
	method: "patch",
	middleware: [authMiddleware],
	path: "/profile",
	request: {
		body: {
			content: {
				"multipart/form-data": {
					schema: UpdateProfileRequestSchema
				}
			}
		}
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(UpdateProfileResponseSchema, "Updated profile result"),
		[HttpStatusCodes.UNAUTHORIZED]: {
			content: {
				"application/json": {
					schema: ProfileErrorResponseSchema
				}
			},
			description: "No authentication token provided or invalid token"
		},
		[HttpStatusCodes.BAD_REQUEST]: {
			content: {
				"application/json": {
					schema: BadRequestResponseSchema
				}
			},
			description: "Invalid input data"
		}
	},
	summary: "Update profile information",
	tags
});

export type UserProfileRoute = typeof getUserProfile;
export type UpdateUserProfileRoute = typeof updateUserProfile;
