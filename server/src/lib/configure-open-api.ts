import { Scalar } from "@scalar/hono-api-reference";
import { NONCE, secureHeaders } from "hono/secure-headers";
import { description, version } from "@/../package.json";
import { asAppMiddleware } from "@/lib/hono-compat";
import type { AppOpenAPI } from "@/lib/types";
import env from "@/utils/env";

const SCALAR_CDN = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.62.5";

const scalarFetch: typeof fetch = Object.assign(
	(input: string | Request | URL, init?: RequestInit) =>
		fetch(input, {
			...init,
			credentials: "include"
		}),
	{ preconnect: fetch.preconnect }
);

export default function configureOpenAPI(app: AppOpenAPI) {
	app.doc31("/doc", {
		info: {
			description: `${description} Includes typed endpoints for chat agents, conversations, profiles, embeddings, and retrieval-augmented generation.`,
			title: "Chat App API",
			version
		},
		openapi: "3.1.0",
		servers: [{ description: "Current deployment", url: "/" }],
		tags: [
			{ description: "AI model discovery, structured generation, evaluation, and streaming", name: "AI" },
			{ description: "Persisted chat history owned by the authenticated user", name: "Conversations" },
			{ description: "Vector ingestion, semantic search, and retrieval-augmented generation", name: "Embeddings" },
			{ description: "Authenticated user profile management", name: "Profile" },
			{ description: "Public service metadata and discovery", name: "Base Route" }
		]
	});

	app.openAPIRegistry.registerComponent("securitySchemes", "CookieAuth", {
		description: "Better Auth session cookie",
		in: "cookie",
		name: "better-auth.session_token",
		type: "apiKey"
	});

	const scalarSecurityHeaders = asAppMiddleware(
		secureHeaders({
			contentSecurityPolicy: {
				baseUri: ["'none'"],
				connectSrc: ["'self'"],
				defaultSrc: ["'none'"],
				fontSrc: ["'self'", "data:"],
				formAction: ["'self'"],
				frameAncestors: ["'none'"],
				imgSrc: ["'self'", "data:", "https:"],
				objectSrc: ["'none'"],
				scriptSrc: [NONCE, "https://cdn.jsdelivr.net"],
				styleSrc: ["'self'", "'unsafe-inline'"],
				workerSrc: ["'self'", "blob:"]
			}
		})
	);

	app.get(
		"/reference",
		scalarSecurityHeaders,
		Scalar((c) => ({
			authentication: {
				preferredSecurityScheme: "CookieAuth"
			},
			cdn: SCALAR_CDN,
			fetch: scalarFetch,
			layout: "modern",
			nonce: c.get("secureHeadersNonce"),
			operationTitleSource: "summary",
			pageTitle: "Chat App API Reference",
			persistAuth: false,
			searchHotKey: "k",
			showDeveloperTools: "localhost",
			showSidebar: true,
			showToolbar: "always",
			sources: [
				{ title: "App API", url: "/doc" },
				{ title: "Auth API", url: `/${env.BASE_API_SLUG}/auth/open-api/generate-schema` }
			],
			telemetry: false,
			theme: "deepSpace"
		}))
	);
}
