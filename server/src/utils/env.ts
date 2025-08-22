/** biome-ignore-all lint/suspicious/noConsole: <allow logs for errors> */
import type { ZodError } from "zod";

import { z } from "zod";

const EnvSchema = z.object({
	AUTH_COOKIE_NAME: z.string().default("token"),
	// Make Azure settings optional for local/minikube without Azure hookup
	AZURE_API_KEY: z.string().optional(),
	AZURE_DEPLOYMENT_NAME: z.string().optional(),
	AZURE_OPENAI_API_ENDPOINT: z.url().optional(),
	AZURE_RESOURCE_NAME: z.string().optional(),
	BASE_API_SLUG: z.string().default("api"),
	CLIENT_URL: z.url(),
	// Optional comma-separated list of allowed CORS origins
	CORS_ORIGINS: z.string().optional(),
	DB_URL: z.url(),
	JWT_SECRET: z.string().min(32),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
	NODE_ENV: z.string().default("production"),
	// OPENAI_API_KEY: z.string(),
	// OPENAI_ORG_ID: z.string(),
	REDIS_URL: z.url(),
	SERPER_API_KEY: z.string(),
	SERVER_PORT: z.coerce.number().min(1).max(65535).default(3000)
});

export type Env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line import/no-mutable-exports
let env: Env;

try {
	env = EnvSchema.parse(Bun.env);
} catch (e) {
	const error = e as ZodError;
	console.error("❌ Invalid env:");
	console.error(z.prettifyError(error));
	process.exit(1);
}

export default env;
