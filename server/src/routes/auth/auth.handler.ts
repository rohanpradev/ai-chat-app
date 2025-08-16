import { deleteCookie } from "hono/cookie";
import { HTTPException } from "hono/http-exception";
import * as HttpStatusCodes from "stoker/http-status-codes";
import db from "@/db";
import { users } from "@/db/schema";
import type { AppRouteHandler } from "@/lib/types";
import type { AuthRoute, CurrentUserRoute, LoginRoute, LogoutRoute } from "@/routes/auth/auth.route";
import env from "@/utils/env";
import { Auth } from "@/utils/token";

export const registerUser: AppRouteHandler<AuthRoute> = async (c) => {
	const { name, email, password } = c.req.valid("json");

	const existingUser = await db.query.users.findFirst({
		where: (user, { eq }) => eq(user.email, email)
	});

	if (existingUser) {
		throw new HTTPException(HttpStatusCodes.CONFLICT, {
			message: "User with this email already exists. Please login instead."
		});
	}

	const [user] = await db
		.insert(users)
		.values({
			email,
			name,
			password: Auth.hashPassword(password)
		})
		.returning({ email: users.email, id: users.id, name: users.name });

	const userDetails = {
		email: user.email,
		id: user.id,
		name: user.name
	};

	const token = await Auth.generateToken({ sub: userDetails });

	Auth.setAuthCookie(c, token);

	return c.json(
		{
			data: userDetails,
			message: "User registered successfully"
		},
		HttpStatusCodes.CREATED
	);
};

export const loginUser: AppRouteHandler<LoginRoute> = async (c) => {
	const { email, password } = c.req.valid("json");

	const existingUser = await db.query.users.findFirst({
		where: (user, { eq }) => eq(user.email, email)
	});

	if (!existingUser) {
		throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
			message: "Invalid credentials"
		});
	}

	const validPassword = await Auth.verifyPassword(password, existingUser.password);

	if (!validPassword) {
		throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
			message: "Invalid credentials"
		});
	}

	const userDetails = {
		email: existingUser.email,
		id: existingUser.id,
		name: existingUser.name
	};

	const token = await Auth.generateToken({ sub: userDetails });

	Auth.setAuthCookie(c, token);

	return c.json(
		{
			data: userDetails,
			message: "User logged in successfully"
		},
		HttpStatusCodes.OK
	);
};

export const logoutUser: AppRouteHandler<LogoutRoute> = async (c) => {
	deleteCookie(c, env.AUTH_COOKIE_NAME, {
		httpOnly: true,
		sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
		secure: env.NODE_ENV === "production",
		...(env.NODE_ENV === "production" && { domain: new URL(env.CLIENT_URL).hostname })
	});

	return c.json(
		{
			message: "User logged out successfully"
		},
		HttpStatusCodes.OK
	);
};

export const getMe: AppRouteHandler<CurrentUserRoute> = async (c) => {
	const token = c.get("jwtPayload");
	if (!token?.sub?.id) {
		throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
			message: "Invalid authentication token"
		});
	}

	const user = await db.query.users.findFirst({
		columns: {
			email: true,
			id: true,
			name: true
		},
		where: (users, { eq }) => eq(users.id, token.sub.id)
	});

	if (!user) {
		throw new HTTPException(HttpStatusCodes.UNAUTHORIZED, {
			message: "User account no longer exists"
		});
	}

	return c.json(
		{
			data: user,
			message: "User authenticated successfully"
		},
		HttpStatusCodes.OK
	);
};
