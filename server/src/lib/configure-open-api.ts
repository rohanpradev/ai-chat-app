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
		description: "JWT authentication using a cookie named `token`",
		in: "cookie",
		name: "token", // the name of your JWT cookie
		type: "apiKey"
	});

	// Simple Scalar configuration
	app.get("/reference", Scalar({ url: "/doc" }));
}
