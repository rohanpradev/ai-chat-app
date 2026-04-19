/** biome-ignore-all lint/suspicious/noConsole: <allow logs for errors> */
import type { ZodError } from "zod";

import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
	if (typeof value === "string" && value.trim() === "") {
		return undefined;
	}

	return value;
};

const normalizedEnv = {
	...Bun.env,
	// Langfuse docs use LANGFUSE_BASE_URL; keep LANGFUSE_BASEURL as a backward-compatible alias.
	LANGFUSE_BASE_URL: Bun.env.LANGFUSE_BASE_URL ?? Bun.env.LANGFUSE_BASEURL
};

const urlSchema = z.string().url();

const EnvSchema = z.object({
	AUTH_COOKIE_NAME: z.string().default("token"),
	BASE_API_SLUG: z.string().default("api"),
	CLIENT_URL: urlSchema,
	// Optional comma-separated list of allowed CORS origins
	CORS_ORIGINS: z.string().optional(),
	DB_URL: urlSchema,
	JWT_SECRET: z.string().min(32),
	LANGFUSE_BASE_URL: z.preprocess(emptyStringToUndefined, urlSchema.optional().default("https://cloud.langfuse.com")),
	LANGFUSE_PUBLIC_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
	// Langfuse observability configuration (optional)
	LANGFUSE_SECRET_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
	NODE_ENV: z.string().default("production"),
	OPENAI_API_KEY: z.string().min(1),
	// Optional comma-separated list of account-specific model ids to expose in the selector.
	OPENAI_MODEL_OVERRIDES: z.string().optional(),
	REDIS_URL: urlSchema,
	SERPER_API_KEY: z.string().optional(),
	SERVER_PORT: z.coerce.number().min(1).max(65535).default(3000)
});

type Env = z.infer<typeof EnvSchema>;

// eslint-disable-next-line import/no-mutable-exports
let env: Env;

try {
	env = EnvSchema.parse(normalizedEnv);
} catch (e) {
	const error = e as ZodError;
	console.error("❌ Invalid env:");
	console.error(z.prettifyError(error));
	process.exit(1);
}

export default env;
