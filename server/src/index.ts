import app from "@/app";
import { initializeTelemetry } from "@/lib/instrumentation";
import env from "@/utils/env";

// Initialize OpenTelemetry/Langfuse before starting the server
initializeTelemetry();

const SERVER_PORT = env.SERVER_PORT;

export default {
	fetch: app.fetch,
	idleTimeout: 250,
	port: SERVER_PORT
};
