import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { AUTH_PASSWORD_MAX_LENGTH, AUTH_PASSWORD_MIN_LENGTH } from "@chat-app/shared";
import { betterAuth } from "better-auth";
import { openAPI } from "better-auth/plugins";
import { db } from "@/db";
import * as schema from "@/db/schema";
import env from "@/utils/env";

const authBasePath = `/${env.BASE_API_SLUG}/auth`;
const authBaseURL = env.BETTER_AUTH_URL ?? env.CLIENT_URL;
const useSecureCookies = authBaseURL.startsWith("https://");

const trustedOrigins = [
	env.CLIENT_URL,
	...(env.CORS_ORIGINS ?? "")
		.split(",")
		.map((origin) => origin.trim())
		.filter((origin) => origin && origin !== "*")
];

const githubProvider =
	env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
		? {
				github: {
					clientId: env.GITHUB_CLIENT_ID,
					clientSecret: env.GITHUB_CLIENT_SECRET,
					scope: ["read:user", "user:email"]
				}
			}
		: undefined;

export const auth = betterAuth({
	account: {
		encryptOAuthTokens: true
	},
	advanced: {
		database: {
			generateId: false
		},
		trustedProxyHeaders: env.NODE_ENV === "production",
		useSecureCookies
	},
	appName: "ChatFlow",
	basePath: authBasePath,
	baseURL: authBaseURL,
	database: drizzleAdapter(db, {
		provider: "pg",
		schema: {
			...schema,
			account: schema.accounts,
			session: schema.sessions,
			user: schema.users,
			verification: schema.verifications
		},
		transaction: true
	}),
	emailAndPassword: {
		enabled: true,
		maxPasswordLength: AUTH_PASSWORD_MAX_LENGTH,
		minPasswordLength: AUTH_PASSWORD_MIN_LENGTH,
		password: {
			hash: (password) => Bun.password.hash(password),
			verify: ({ hash, password }) => Bun.password.verify(password, hash)
		}
	},
	plugins: [openAPI()],
	socialProviders: githubProvider,
	trustedOrigins
});
