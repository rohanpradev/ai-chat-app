import { Scalar } from "@scalar/hono-api-reference";
import { description, version } from "@/../package.json";
import type { AppOpenAPI } from "@/lib/types";
import env from "@/utils/env";

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
			authentication: {
				preferredSecurityScheme: "CookieAuth"
			},
			fetch: (input: string | Request | URL, init?: RequestInit) =>
				fetch(input, {
					...init,
					credentials: "include"
				}),
			pageTitle: "AI API Reference",
			sources: [
				{ title: "App API", url: "/doc" },
				{ title: "Auth API", url: `/${env.BASE_API_SLUG}/auth/open-api/generate-schema` }
			]
		})
	);
}
