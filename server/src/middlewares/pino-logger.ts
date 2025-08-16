import { pinoLogger as logger } from "hono-pino";
import pino from "pino";
import pretty from "pino-pretty";

import env from "@/utils/env";

export function pinoLogger() {
	return logger({
		http: { reqId: () => Bun.randomUUIDv7() },
		pino: pino(
			{ level: env.LOG_LEVEL, redact: ["password", "email", "token"] },
			env.NODE_ENV === "production" ? undefined : pretty()
		)
	});
}
