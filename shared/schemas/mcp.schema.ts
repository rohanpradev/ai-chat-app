import { z } from "zod";

export const McpServerSchema = z.object({
	description: z.string(),
	id: z.string(),
	name: z.string(),
	toolCount: z.number(),
});
export const McpServersSchema = z.object({ servers: z.array(McpServerSchema) });
export const McpInspectSchema = z.object({ serverId: z.string().min(1).max(64) });
export const McpCapabilitySchema = z.object({
	arguments: z
		.array(z.object({ description: z.string().optional(), name: z.string(), required: z.boolean().optional() }))
		.optional(),
	description: z.string(),
	inputSchema: z.record(z.string(), z.unknown()).optional(),
	kind: z.enum(["tool", "resource", "prompt"]),
	name: z.string(),
	title: z.string(),
});
export const McpInspectionSchema = z.object({
	capabilities: z.array(McpCapabilitySchema),
	durationMs: z.number(),
	protocolVersion: z.string(),
	serverId: z.string(),
	serverVersion: z.string(),
	truncated: z.boolean(),
});
export const McpActionSchema = z.object({
	action: z.enum(["discover", "call", "read", "prompt"]),
	argumentsJson: z
		.string()
		.max(16000)
		.describe("JSON object of tool or prompt arguments. Use {} for discovery or resource reads."),
	name: z
		.string()
		.max(2000)
		.describe(
			"Exact tool name, resource URI, or prompt name. For discovery, use task keywords to filter capabilities, or empty to list all.",
		),
	serverId: z.string().min(1).max(64),
});
export const McpPreviewSchema = McpActionSchema.extend({ action: z.enum(["read", "prompt"]) });
export const McpResultSchema = z.object({
	action: z.string(),
	durationMs: z.number(),
	isError: z.boolean(),
	name: z.string(),
	serverId: z.string(),
	text: z.string().max(24000),
	truncated: z.boolean(),
});
export type McpServer = z.infer<typeof McpServerSchema>;
export type McpCapability = z.infer<typeof McpCapabilitySchema>;
export type McpInspection = z.infer<typeof McpInspectionSchema>;
export type McpAction = z.infer<typeof McpActionSchema>;
export type McpResult = z.infer<typeof McpResultSchema>;
