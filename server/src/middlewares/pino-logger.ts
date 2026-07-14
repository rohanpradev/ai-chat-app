import { pinoLogger as logger } from "hono-pino";
import pino from "pino";
import pretty from "pino-pretty";

import { asAppMiddleware } from "@/lib/hono-compat";
import { getActiveTraceContext } from "@/lib/observability";
import type { AppMiddleware } from "@/lib/types";
import env from "@/utils/env";

const getActiveObservabilityBinding = () => {
	const activeTraceContext = getActiveTraceContext();

	return activeTraceContext ? { observability: activeTraceContext } : {};
};

export function pinoLogger(): AppMiddleware {
	return asAppMiddleware(
		logger({
			http: {
				onResBindings: (c) => ({
					res: {
						headers: Object.fromEntries(c.res.headers.entries()),
						status: c.res.status
					},
					...getActiveObservabilityBinding()
				})
			},
			pino: pino(
				{
					level: env.LOG_LEVEL,
					mixin: getActiveObservabilityBinding,
					redact: {
						paths: [
							"authorization",
							"cookie",
							"password",
							"token",
							"req.headers.authorization",
							"req.headers.cookie",
							"req.headers.set-cookie",
							"res.headers.set-cookie",
							"*.password",
							"*.token",
							"*.secret",
							"*.apiKey"
						],
						remove: true
					}
				},
				env.NODE_ENV === "production" ? undefined : pretty()
			)
		})
	);
}
