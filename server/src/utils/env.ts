/** biome-ignore-all lint/suspicious/noConsole: <allow logs for errors> */
import type { ZodError } from "zod";

import { z } from "zod";

const EnvSchema = z
	.object({
		AUTH_COOKIE_NAME: z.string().default("token"),
		// Make Azure settings optional for local/minikube without Azure hookup
		AZURE_API_KEY: z.string().optional(),
		AZURE_RESOURCE_NAME: z.string().optional(),
		BASE_API_SLUG: z.string().default("api"),
		CLIENT_URL: z.url(),
		// Optional comma-separated list of allowed CORS origins
		CORS_ORIGINS: z.string().optional(),
		DB_URL: z.url(),
		JWT_SECRET: z.string().min(32),
		LANGFUSE_BASEURL: z.url().optional().default("https://cloud.langfuse.com"),
		LANGFUSE_PUBLIC_KEY: z.string().optional(),
		// Langfuse observability configuration (optional)
		LANGFUSE_SECRET_KEY: z.string().optional(),
		LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
		NODE_ENV: z.string().default("production"),
		OPENAI_API_KEY: z.string().optional(),
		REDIS_URL: z.url(),
		SERPER_API_KEY: z.string().optional(),
		SERVER_PORT: z.coerce.number().min(1).max(65535).default(3000)
	})
	.refine((data) => data.AZURE_API_KEY || data.OPENAI_API_KEY, {
		message: "At least one AI provider API key is required: AZURE_API_KEY or OPENAI_API_KEY",
		path: ["AZURE_API_KEY"]
	})
	.refine((data) => !data.AZURE_API_KEY || data.AZURE_RESOURCE_NAME, {
		message: "AZURE_RESOURCE_NAME is required when AZURE_API_KEY is provided",
		path: ["AZURE_RESOURCE_NAME"]
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
