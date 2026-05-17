import { auth } from "@/lib/auth";
import configureOpenAPI from "@/lib/configure-open-api";
import { createApp } from "@/lib/create-app";
import ai from "@/routes/ai/ai.index";
import conversations from "@/routes/conversations/conversations.index";
import embeddings from "@/routes/embeddings/embeddings.index";
import index from "@/routes/index.route";
import profile from "@/routes/profile/profile.index";
import env from "@/utils/env";

const app = createApp();

const routes = [profile, ai, conversations, embeddings];

app.route("/", index);
app.on(["GET", "POST"], `/${env.BASE_API_SLUG}/auth/*`, (c) => auth.handler(c.req.raw));

for (const route of routes) {
	app.route(`/${env.BASE_API_SLUG}`, route);
}

configureOpenAPI(app);

export default app;
