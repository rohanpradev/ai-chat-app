import app from "@/app";
import { shutdownLangfuse } from "@/lib/langfuse";
import env from "@/utils/env";

const SERVER_PORT = env.SERVER_PORT;

process.on("SIGINT", async () => {
	await shutdownLangfuse();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	await shutdownLangfuse();
	process.exit(0);
});

export default {
	fetch: app.fetch,
	idleTimeout: 250,
	port: SERVER_PORT
};
