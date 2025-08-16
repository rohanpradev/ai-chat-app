import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import type { JWTPayload } from "hono/utils/jwt/types";
import env from "@/utils/env";

export const TOKEN_EXPIRY_SECONDS = 7 * 24 * 60 * 60;

// biome-ignore lint/complexity/noStaticOnlyClass: <Allow auth to be static>
export class Auth {
	static generateToken(payload: JWTPayload): Promise<string> {
		return sign({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_SECONDS }, env.JWT_SECRET);
	}

	static hashPassword(password: string): string {
		return Bun.password.hashSync(password);
	}

	static verifyPassword(password: string, hash: string): Promise<boolean> {
		return Bun.password.verify(password, hash);
	}

	static setAuthCookie(c: Context, token: string): void {
		setCookie(c, env.AUTH_COOKIE_NAME, token, {
			httpOnly: true,
			maxAge: TOKEN_EXPIRY_SECONDS,
			sameSite: env.NODE_ENV === "production" ? "strict" : "lax",
			secure: env.NODE_ENV === "production",
			...(env.NODE_ENV === "production" && { domain: new URL(env.CLIENT_URL).hostname })
		});
	}
}
