import app from "@/app";
import env from "@/utils/env";

const PORT = env.PORT;

export default {
	fetch: app.fetch,
	idleTimeout: 250,
	port: PORT
};
