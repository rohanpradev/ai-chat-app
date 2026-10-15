import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import {
	type McpAction,
	McpActionSchema,
	type McpCapability,
	type McpInspection,
	McpInspectionSchema,
	type McpResult,
	McpResultSchema
} from "@chat-app/shared";
import { z } from "zod";

// Only operators choose destinations and credentials. Browser/model input never supplies URLs or headers.
const serverConfigSchema = z.object({
	allowedTools: z.array(z.string().min(1)).max(100).default([]),
	description: z.string().max(500).default(""),
	headers: z.record(z.string(), z.string()).default({}),
	id: z.string().regex(/^[a-z0-9-]{1,64}$/),
	name: z.string().min(1).max(100),
	prompts: z.boolean().default(false),
	resources: z.boolean().default(false),
	url: z.url().refine((value) => {
		const url = new URL(value);
		return url.protocol === "https:" && !url.username && !url.password && !url.hash && !url.search;
	}),
	userIds: z.array(z.string().min(1)).min(1)
});
export const parseMcpConfig = (raw: string) => {
	try {
		const servers = z.array(serverConfigSchema).max(20).parse(JSON.parse(raw));
		if (new Set(servers.map((server) => server.id)).size !== servers.length) throw new Error();
		return servers;
	} catch {
		throw new Error("Invalid MCP_SERVERS configuration. Check IDs, HTTPS URLs, userIds and allowedTools.");
	}
};
type ServerConfig = z.infer<typeof serverConfigSchema>;
type Client = Pick<
	MCPClient,
	| "serverInfo"
	| "initializeResult"
	| "listTools"
	| "listResources"
	| "experimental_listPrompts"
	| "callTool"
	| "readResource"
	| "experimental_getPrompt"
	| "close"
>;
type ClientFactory = (config: Parameters<typeof createMCPClient>[0]) => Promise<Client>;
export class McpServiceError extends Error {
	readonly status: 400 | 404 | 502 | 504;
	constructor(message: string, status: 400 | 404 | 502 | 504 = 502) {
		super(message);
		this.status = status;
	}
}
const MAX_ITEMS = 100;
const timeoutMs = 20000;
const recordSchema = z.record(z.string(), z.unknown());

export const createMcpService = (servers: ServerConfig[], connect: ClientFactory = createMCPClient) => {
	const list = (userId: string) => ({
		servers: servers
			.filter((server) => server.userIds.includes(userId))
			.map((server) => ({
				description: server.description,
				id: server.id,
				name: server.name,
				toolCount: server.allowedTools.length
			}))
	});
	const withClient = async <T>(
		serverId: string,
		userId: string,
		signal: AbortSignal | undefined,
		run: (client: Client, server: ServerConfig, signal: AbortSignal) => Promise<T>
	): Promise<T> => {
		const server = servers.find((candidate) => candidate.id === serverId && candidate.userIds.includes(userId));
		if (!server) throw new McpServiceError("MCP connection not found.", 404);
		const bounded = AbortSignal.any([AbortSignal.timeout(timeoutMs), ...(signal ? [signal] : [])]);
		let client: Client | undefined;
		try {
			bounded.throwIfAborted();
			client = await connect({
				clientName: "chatflow",
				initializationOptions: { signal: bounded, timeout: timeoutMs },
				maxRetries: 0,
				transport: {
					fetch: Object.assign(
						(url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
							fetch(url, {
								...init,
								redirect: "error",
								signal: AbortSignal.any([bounded, ...(init?.signal ? [init.signal] : [])])
							}),
						{ preconnect: fetch.preconnect }
					),
					headers: server.headers,
					redirect: "error",
					type: "http",
					url: server.url
				}
			});
			return await run(client, server, bounded);
		} catch (error) {
			if (error instanceof McpServiceError) throw error;
			if (bounded.aborted)
				throw new McpServiceError("MCP request was cancelled or timed out. Check the connection before trying again.", 504);
			throw new McpServiceError("The MCP server could not complete this request. Check its connection and permissions.");
		} finally {
			await client?.close().catch(() => undefined);
		}
	};
	const discover = async (
		client: Client,
		server: ServerConfig,
		signal: AbortSignal
	): Promise<{ capabilities: McpCapability[]; truncated: boolean }> => {
		const capabilities: McpCapability[] = [];
		let truncated = false;
		const supported = client.initializeResult.capabilities;
		// Bound every catalog independently; cursors are followed, never silently mistaken for a complete list.
		if (supported.tools) {
			let cursor: string | undefined;
			let count = 0;
			do {
				const page = await client.listTools({ options: { signal }, params: { cursor } });
				for (const entry of page.tools) {
					if (count++ >= MAX_ITEMS) {
						truncated = true;
						break;
					}
					if (server.allowedTools.includes(entry.name))
						capabilities.push({
							description: entry.description ?? "",
							inputSchema: entry.inputSchema,
							kind: "tool",
							name: entry.name,
							title: entry.title ?? entry.name
						});
				}
				cursor = page.nextCursor;
			} while (cursor && count < MAX_ITEMS);
			truncated ||= Boolean(cursor);
		}
		if (supported.resources && server.resources) {
			let cursor: string | undefined;
			let count = 0;
			do {
				const page = await client.listResources({ options: { signal }, params: { cursor } });
				for (const entry of page.resources) {
					if (count++ >= MAX_ITEMS) {
						truncated = true;
						break;
					}
					capabilities.push({
						description: entry.description ?? "",
						kind: "resource",
						name: entry.uri,
						title: entry.title ?? entry.name
					});
				}
				cursor = page.nextCursor;
			} while (cursor && count < MAX_ITEMS);
			truncated ||= Boolean(cursor);
		}
		if (supported.prompts && server.prompts) {
			let cursor: string | undefined;
			let count = 0;
			do {
				const page = await client.experimental_listPrompts({ options: { signal }, params: { cursor } });
				for (const entry of page.prompts) {
					if (count++ >= MAX_ITEMS) {
						truncated = true;
						break;
					}
					capabilities.push({
						arguments: entry.arguments,
						description: entry.description ?? "",
						kind: "prompt",
						name: entry.name,
						title: entry.title ?? entry.name
					});
				}
				cursor = page.nextCursor;
			} while (cursor && count < MAX_ITEMS);
			truncated ||= Boolean(cursor);
		}
		return { capabilities, truncated };
	};
	const inspect = (serverId: string, userId: string, signal?: AbortSignal): Promise<McpInspection> =>
		withClient(serverId, userId, signal, async (client, server, bounded) => {
			const start = performance.now();
			return McpInspectionSchema.parse({
				protocolVersion: client.initializeResult.protocolVersion,
				serverId,
				serverVersion: client.serverInfo.version,
				...(await discover(client, server, bounded)),
				durationMs: Math.round(performance.now() - start)
			});
		});
	const execute = async (input: McpAction, userId: string, signal?: AbortSignal): Promise<McpResult> => {
		const request = McpActionSchema.parse(input);
		let args: Record<string, unknown>;
		try {
			args = recordSchema.parse(JSON.parse(request.argumentsJson));
		} catch {
			throw new McpServiceError("Arguments must be a JSON object.", 400);
		}
		return withClient(request.serverId, userId, signal, async (client, server, bounded) => {
			const start = performance.now();
			const catalog = await discover(client, server, bounded);
			const terms = request.action === "discover" ? request.name.toLowerCase().split(/\s+/).filter(Boolean) : [];
			const matches = terms.length
				? catalog.capabilities.filter((entry) =>
						terms.some((term) => `${entry.title} ${entry.name} ${entry.description}`.toLowerCase().includes(term))
					)
				: catalog.capabilities;
			let payload: unknown = { ...catalog, capabilities: matches };
			let isError = false;
			if (request.action !== "discover") {
				const kind = { call: "tool", prompt: "prompt", read: "resource" }[request.action];
				const capability = catalog.capabilities.find((entry) => entry.kind === kind && entry.name === request.name);
				if (!capability) throw new McpServiceError("This capability is unavailable or not allowed.", 404);
				if (request.action === "call") {
					if (!capability.inputSchema) throw new McpServiceError("This tool has no supported input schema.", 400);
					try {
						z.fromJSONSchema(capability.inputSchema).parse(args);
					} catch {
						throw new McpServiceError("Arguments do not match this tool's input schema.", 400);
					}
					const result = await client.callTool({ arguments: args, name: request.name, options: { signal: bounded } });
					isError = result.isError === true;
					payload = result;
				} else if (request.action === "read") {
					payload = await client.readResource({ options: { signal: bounded }, uri: request.name });
				} else {
					for (const argument of capability.arguments ?? []) {
						if (argument.required && !(argument.name in args))
							throw new McpServiceError(`Missing prompt argument: ${argument.name}`, 400);
					}
					if (!Object.values(args).every((value) => typeof value === "string"))
						throw new McpServiceError("Prompt arguments must be strings.", 400);
					payload = await client.experimental_getPrompt({
						arguments: args,
						name: request.name,
						options: { signal: bounded }
					});
				}
			}
			// Remote content stays data. Never execute HTML, render embedded apps, or promote prompt text to system instructions.
			const serialized = JSON.stringify(
				payload,
				function (this: unknown, key, value: unknown) {
					const binary =
						this && typeof this === "object" && "type" in this && (this.type === "image" || this.type === "audio");
					return key === "blob" || (key === "data" && binary) ? "[Binary content omitted]" : value;
				},
				2
			);
			return McpResultSchema.parse({
				action: request.action,
				durationMs: Math.round(performance.now() - start),
				isError,
				name: request.name,
				serverId: server.id,
				text: serialized.slice(0, 24000),
				truncated: serialized.length > 24000 || (request.action === "discover" && catalog.truncated)
			});
		});
	};
	return { execute, inspect, list };
};
