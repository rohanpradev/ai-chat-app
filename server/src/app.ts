import configureOpenAPI from "@/lib/configure-open-api";
import { createApp } from "@/lib/create-app";
import ai from "@/routes/ai/ai.index";
import auth from "@/routes/auth/auth.index";
import conversations from "@/routes/conversations/conversations.index";
import index from "@/routes/index.route";
import profile from "@/routes/profile/profile.index";
import env from "@/utils/env";

const app = createApp();

const routes = [auth, profile, ai, conversations];

app.route("/", index);

app.get("/health", (c) => {
	return c.text("healthy", 200);
});

for (const route of routes) {
	app.route(`/${env.BASE_API_SLUG}`, route);
}

configureOpenAPI(app);

export default app;
