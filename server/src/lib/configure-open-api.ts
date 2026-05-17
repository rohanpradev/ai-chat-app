import { Scalar } from "@scalar/hono-api-reference";
import { description, version } from "@/../package.json";
import type { AppOpenAPI } from "@/lib/types";

export default function configureOpenAPI(app: AppOpenAPI) {
	app.doc("/doc", {
		info: {
			description,
			title: "AI API",
			version
		},
		openapi: "3.0.0"
	});

	app.openAPIRegistry.registerComponent("securitySchemes", "CookieAuth", {
		description: "Better Auth session cookie",
		in: "cookie",
		name: "better-auth.session_token",
		type: "apiKey"
	});

	app.get(
		"/reference",
		Scalar({
			pageTitle: "AI API Reference",
			url: "/doc"
		})
	);
}
