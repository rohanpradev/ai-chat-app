import "@/instrumentation";
import { redis } from "bun";
import pino from "pino";
import app from "@/app";
import { closeDatabase } from "@/db";
import { shutdownTelemetry } from "@/lib/instrumentation";
import { beginShutdown } from "@/lib/lifecycle";
import { createServerOptions } from "@/lib/server-runtime";
import env from "@/utils/env";

const logger = pino({ level: env.LOG_LEVEL, name: "server" });
const server = Bun.serve(
	createServerOptions({
		apiSlug: env.BASE_API_SLUG,
		fetch: app.fetch,
		port: env.SERVER_PORT
	})
);
const gracefulShutdownTimeoutMs = 25_000;
let shutdownPromise: Promise<void> | null = null;

const shutdown = (signal: NodeJS.Signals) => {
	if (shutdownPromise) {
		return shutdownPromise;
	}

	beginShutdown();
	logger.info({ signal }, "Graceful shutdown started");

	shutdownPromise = (async () => {
		let forceTimer: ReturnType<typeof setTimeout> | undefined;
		const gracefulStop = server.stop(false).then(() => false);
		const forceStop = new Promise<true>((resolve) => {
			forceTimer = setTimeout(() => resolve(true), gracefulShutdownTimeoutMs);
		});
		const timedOut = await Promise.race([gracefulStop, forceStop]);
		if (forceTimer) {
			clearTimeout(forceTimer);
		}

		if (timedOut) {
			logger.warn({ signal }, "Graceful shutdown timed out; closing active connections");
			await server.stop(true);
		}

		const results = await Promise.allSettled([closeDatabase(), shutdownTelemetry(signal)]);
		redis.close();

		for (const result of results) {
			if (result.status === "rejected") {
				logger.error({ error: result.reason, signal }, "Resource shutdown failed");
			}
		}

		logger.info({ signal }, "Graceful shutdown completed");
	})();

	return shutdownPromise;
};

process.once("SIGINT", () => {
	void shutdown("SIGINT");
});
process.once("SIGTERM", () => {
	void shutdown("SIGTERM");
});

export { server, shutdown };
