import configureOpenAPI from "@/lib/configure-open-api";
import { createApp } from "@/lib/create-app";
import { initializeLangfuse } from "@/lib/langfuse";
import { langfuseMiddleware } from "@/middlewares/langfuse-middleware";
import ai from "@/routes/ai/ai.index";
import auth from "@/routes/auth/auth.index";
import conversations from "@/routes/conversations/conversations.index";
import index from "@/routes/index.route";
import profile from "@/routes/profile/profile.index";
import env from "@/utils/env";

// Initialize Langfuse observability before creating the app
initializeLangfuse();

const app = createApp();

// Add Langfuse tracing middleware
app.use("*", langfuseMiddleware());

const routes = [auth, profile, ai, conversations];

app.route("/", index);

app.get("/health", (c) => {
	return c.text("healthy", 200);
});

for (const route of routes) {
	app.route(`/${env.BASE_API_SLUG}`, route);
}

// Add health endpoint under API routes too
app.get(`/${env.BASE_API_SLUG}/health`, (c) => {
	return c.json({ status: "healthy", timestamp: new Date().toISOString() }, 200);
});

configureOpenAPI(app);

export default app;
