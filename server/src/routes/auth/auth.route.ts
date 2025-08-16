import {
	ErrorResponseSchema,
	LoginResponseSchema,
	LoginUserRequestSchema,
	LogoutResponseSchema,
	MeResponseSchema,
	RegisterResponseSchema,
	RegisterUserRequestSchema,
	UnauthorizedResponseSchema
} from "@chat-app/shared";
import { createRoute } from "@hono/zod-openapi";
import * as HttpStatusCodes from "stoker/http-status-codes";
import { jsonContent } from "stoker/openapi/helpers";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { redisCache } from "@/middlewares/redis-cache-middleware";

const tags = ["Auth"];

export const registerUser = createRoute({
	description: "Register a new user",
	method: "post",
	path: "/auth/register",
	request: {
		body: {
			content: {
				"application/json": {
					schema: RegisterUserRequestSchema
				}
			}
		}
	},
	responses: {
		[HttpStatusCodes.CREATED]: jsonContent(RegisterResponseSchema, "User registration successful"),
		[HttpStatusCodes.UNAUTHORIZED]: {
			content: {
				"application/json": {
					schema: ErrorResponseSchema
				}
			},
			description: "User already exists"
		}
	},
	summary: "Register a new user",
	tags
});

export const loginUser = createRoute({
	description: "Login for existing users",
	method: "post",
	path: "/auth/login",
	request: {
		body: {
			content: {
				"application/json": {
					schema: LoginUserRequestSchema
				}
			}
		}
	},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(LoginResponseSchema, "User login successful"),
		[HttpStatusCodes.UNAUTHORIZED]: {
			content: {
				"application/json": {
					schema: ErrorResponseSchema
				}
			},
			description: "User doesnt exists"
		}
	},
	summary: "login user",
	tags
});

export const logoutUser = createRoute({
	description: "Logout current user",
	method: "post",
	middleware: [authMiddleware],
	path: "/auth/logout",
	request: {},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(LogoutResponseSchema, "Logged out")
	},
	security: [{ CookieAuth: [] }],
	summary: "Logout user",
	tags
});

export const me = createRoute({
	description: "Get current authenticated user information",
	method: "get",
	middleware: [
		authMiddleware,
		redisCache({
			key: (c) => {
				const userId = c.get("jwtPayload")?.sub?.id || "anonymous";
				return `user:${userId}:auth:me`;
			},
			ttl: 300
		})
	],
	path: "/auth/me",
	request: {},
	responses: {
		[HttpStatusCodes.OK]: jsonContent(MeResponseSchema, "Current user information"),
		[HttpStatusCodes.UNAUTHORIZED]: jsonContent(UnauthorizedResponseSchema, "User not authenticated")
	},
	security: [{ CookieAuth: [] }],
	summary: "Gets the current logged in user",
	tags
});

export type AuthRoute = typeof registerUser;
export type LoginRoute = typeof loginUser;
export type LogoutRoute = typeof logoutUser;
export type CurrentUserRoute = typeof me;
