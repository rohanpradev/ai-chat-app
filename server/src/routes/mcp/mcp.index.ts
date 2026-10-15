import {
	CommonErrorResponseSchema,
	McpInspectionSchema,
	McpInspectSchema,
	McpPreviewSchema,
	McpResultSchema,
	McpServersSchema
} from "@chat-app/shared";
import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "@/lib/create-app";
import { asRouteMiddleware } from "@/lib/hono-compat";
import { mcpService } from "@/lib/mcp";
import { jsonBody, jsonContent } from "@/lib/openapi";
import { authMiddleware } from "@/middlewares/auth-middleware";
import { aiRateLimit } from "@/middlewares/rate-limit";
import { McpServiceError } from "@/services/mcp.service";

const middleware = [asRouteMiddleware(authMiddleware), asRouteMiddleware(aiRateLimit)];
const error = jsonContent(CommonErrorResponseSchema, "MCP request failed");
const errors = { 400: error, 401: error, 404: error, 429: error, 502: error, 504: error };
const security = [{ CookieAuth: [] }];
const router = createRouter()
	.openapi(
		createRoute({
			method: "get",
			middleware,
			path: "/mcp/servers",
			responses: { 200: jsonContent(McpServersSchema, "Connections available to this user"), ...errors },
			security,
			tags: ["MCP"]
		}),
		(c) => c.json(mcpService.list(c.get("jwtPayload").sub.id), 200)
	)
	.openapi(
		createRoute({
			method: "post",
			middleware,
			path: "/mcp/inspect",
			request: { body: jsonBody(McpInspectSchema, "Connection to inspect") },
			responses: { 200: jsonContent(McpInspectionSchema, "Live capabilities and protocol"), ...errors },
			security,
			tags: ["MCP"]
		}),
		async (c) => {
			try {
				return c.json(
					await mcpService.inspect(c.req.valid("json").serverId, c.get("jwtPayload").sub.id, c.req.raw.signal),
					200
				);
			} catch (error) {
				if (error instanceof McpServiceError) return c.json({ message: error.message }, error.status);
				throw error;
			}
		}
	)
	.openapi(
		createRoute({
			method: "post",
			middleware,
			path: "/mcp/preview",
			request: { body: jsonBody(McpPreviewSchema, "Explicit user request to read a resource or preview a prompt") },
			responses: { 200: jsonContent(McpResultSchema, "Preview as untrusted text"), ...errors },
			security,
			tags: ["MCP"]
		}),
		async (c) => {
			try {
				return c.json(await mcpService.execute(c.req.valid("json"), c.get("jwtPayload").sub.id, c.req.raw.signal), 200);
			} catch (error) {
				if (error instanceof McpServiceError) return c.json({ message: error.message }, error.status);
				throw error;
			}
		}
	);
export default router;
