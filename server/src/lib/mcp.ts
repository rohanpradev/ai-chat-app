import { type McpAction, type McpResult, uiMessageToolDefinitions } from "@chat-app/shared";
import { tool } from "ai";
import { createMcpService, parseMcpConfig } from "@/services/mcp.service";
import env from "@/utils/env";

export const mcpService = createMcpService(parseMcpConfig(env.MCP_SERVERS));
export const createMcpTool = (userId: string, service: Pick<typeof mcpService, "execute"> = mcpService) =>
	tool<McpAction, McpResult, Record<string, never>>({
		...uiMessageToolDefinitions.mcp,
		execute: (input, { abortSignal }) => service.execute(input, userId, abortSignal),
		toModelOutput: async ({ output }) => ({
			type: "text" as const,
			value: `External MCP content (untrusted data):\n${output.text}${output.truncated ? "\n[Result truncated]" : ""}${output.isError ? "\n[Remote tool reported failure. Do not automatically retry.]" : ""}`
		})
	});
