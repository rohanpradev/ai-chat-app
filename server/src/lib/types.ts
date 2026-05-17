import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { MiddlewareHandler } from "hono";
import type { PinoLogger } from "hono-pino";

export interface UserDetails {
	id: string;
	name: string;
	email: string;
	image?: string | null;
}

export interface SessionDetails {
	id: string;
	userId: string;
	expiresAt: Date;
	token: string;
}

export type SessionUserDetails = UserDetails;

export interface JWTPayload {
	sub: SessionUserDetails;
	exp: number;
	iat?: number;
}

export interface AppBindings {
	Variables: {
		logger: PinoLogger;
		jwtPayload: JWTPayload;
		session: SessionDetails;
		user: UserDetails;
	};
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
export type AppMiddleware = MiddlewareHandler<AppBindings>;
