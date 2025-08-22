import app from "@/app";
import env from "@/utils/env";

const SERVER_PORT = env.SERVER_PORT;

export default {
	fetch: app.fetch,
	idleTimeout: 250,
	port: SERVER_PORT
};
