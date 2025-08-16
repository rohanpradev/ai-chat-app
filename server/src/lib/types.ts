import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { PinoLogger } from "hono-pino";

export interface UserDetails {
	id: string;
	name: string;
	email: string;
}

export interface JWTPayload {
	sub: UserDetails;
	exp: number;
	iat?: number;
}

export interface AppBindings {
	Variables: {
		logger: PinoLogger;
		jwtPayload: JWTPayload;
	};
}

export type AppOpenAPI = OpenAPIHono<AppBindings>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;
