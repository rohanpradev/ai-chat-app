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
import { asRouteMiddleware } from "@/lib/hono-compat";
import * as HttpStatusCodes from "@/lib/http-status-codes";
import { jsonContent } from "@/lib/openapi";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { redisCache } from "@/middlewares/redis-cache-middleware";

const tags = ["Auth"];
const authenticated = asRouteMiddleware(authMiddleware);
const cachedMe = redisCache({
	key: (c) => {
		const jwtPayload = c.get("jwtPayload") as { sub?: { id?: string } } | undefined;
		const userId = jwtPayload?.sub?.id || "anonymous";
		return `user:${userId}:auth:me`;
	},
	ttl: 300
});

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
	middleware: [authenticated],
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
	middleware: [authenticated, asRouteMiddleware(cachedMe)],
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
