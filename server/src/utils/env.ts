/** biome-ignore-all lint/suspicious/noConsole: <allow logs for errors> */
import type { ZodError } from "zod";

import { z } from "zod";

const EnvSchema = z.object({
	AUTH_COOKIE_NAME: z.string().default("token"),
	AZURE_API_KEY: z.string(),
	AZURE_DEPLOYMENT_NAME: z.string(),
	AZURE_OPENAI_API_ENDPOINT: z.url(),
	AZURE_RESOURCE_NAME: z.string(),
	BASE_API_SLUG: z.string().default("api"),
	CLIENT_URL: z.url(),
	DB_URL: z.url(),
	JWT_SECRET: z.string().min(32),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]),
	NODE_ENV: z.string(),
	PORT: z.coerce.number(),
	REDIS_URL: z.url(),
	SERPER_API_KEY: z.string()
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
