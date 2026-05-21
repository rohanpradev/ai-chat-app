/** biome-ignore-all lint/suspicious/noConsole: <allow logs for errors> */
import type { ZodError } from "zod";

import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
	if (typeof value === "string" && value.trim() === "") {
		return undefined;
	}

	return value;
};

const booleanStringToBoolean = (value: unknown) => {
	if (typeof value !== "string") {
		return value;
	}

	if (value.trim() === "") {
		return undefined;
	}

	if (value.toLowerCase() === "true") {
		return true;
	}

	if (value.toLowerCase() === "false") {
		return false;
	}

	return value;
};

const firstNonEmptyString = (...values: Array<string | undefined>) => values.find((value) => value?.trim());

const sampleRateSchema = z.preprocess(emptyStringToUndefined, z.coerce.number().min(0).max(1).optional().default(0.1));

const normalizedEnv = {
	...Bun.env,
	BETTER_AUTH_SECRET: firstNonEmptyString(Bun.env.BETTER_AUTH_SECRET, Bun.env.AUTH_SECRET, Bun.env.JWT_SECRET),
	// Langfuse docs use LANGFUSE_BASE_URL; keep LANGFUSE_BASEURL as a backward-compatible alias.
	LANGFUSE_BASE_URL: Bun.env.LANGFUSE_BASE_URL ?? Bun.env.LANGFUSE_BASEURL
};

const urlSchema = z.string().url();

const EnvSchema = z.object({
	BASE_API_SLUG: z.string().default("api"),
	BETTER_AUTH_SECRET: z.string().min(32),
	BETTER_AUTH_URL: z.preprocess(emptyStringToUndefined, urlSchema.optional()),
	CLIENT_URL: urlSchema,
	// Optional comma-separated list of allowed CORS origins
	CORS_ORIGINS: z.string().optional(),
	DB_URL: urlSchema,
	GITHUB_CLIENT_ID: z.preprocess(emptyStringToUndefined, z.string().optional()),
	GITHUB_CLIENT_SECRET: z.preprocess(emptyStringToUndefined, z.string().optional()),
	LANGFUSE_BASE_URL: z.preprocess(emptyStringToUndefined, urlSchema.optional().default("https://cloud.langfuse.com")),
	LANGFUSE_PUBLIC_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
	// Langfuse observability configuration (optional)
	LANGFUSE_SECRET_KEY: z.preprocess(emptyStringToUndefined, z.string().optional()),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
	NODE_ENV: z.string().default("production"),
	OPENAI_API_KEY: z.string().min(1),
	REDIS_URL: urlSchema,
	SENTRY_DSN: z.preprocess(emptyStringToUndefined, urlSchema.optional()),
	SENTRY_ENVIRONMENT: z.preprocess(emptyStringToUndefined, z.string().optional()),
	SENTRY_RELEASE: z.preprocess(emptyStringToUndefined, z.string().optional()),
	SENTRY_SEND_DEFAULT_PII: z.preprocess(booleanStringToBoolean, z.boolean().default(false)),
	SENTRY_TRACES_SAMPLE_RATE: sampleRateSchema,
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
