import { auth } from "@/lib/auth";
import configureOpenAPI from "@/lib/configure-open-api";
import { createApp, createRouter } from "@/lib/create-app";
import ai from "@/routes/ai/ai.index";
import conversations from "@/routes/conversations/conversations.index";
import embeddings from "@/routes/embeddings/embeddings.index";
import index from "@/routes/index.route";
import profile from "@/routes/profile/profile.index";
import env from "@/utils/env";

const apiRoutes = createRouter().route("/", profile).route("/", ai).route("/", conversations).route("/", embeddings);

const app = createApp();
configureOpenAPI(app);

const routedApp = app
	.route("/", index)
	.on(["GET", "POST"], `/${env.BASE_API_SLUG}/auth/*`, (c) => auth.handler(c.req.raw))
	.route(`/${env.BASE_API_SLUG}`, apiRoutes);

export default routedApp;
