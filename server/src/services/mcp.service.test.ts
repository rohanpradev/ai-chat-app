import { describe, expect, it, mock } from "bun:test";
import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import { McpPreviewSchema } from "@chat-app/shared";
import { createMcpService, parseMcpConfig } from "@/services/mcp.service";

const config = () =>
	parseMcpConfig(
		JSON.stringify([
			{
				allowedTools: ["search"],
				headers: { Authorization: "Bearer secret" },
				id: "docs",
				name: "Documentation",
				prompts: true,
				resources: true,
				url: "https://mcp.example.com/mcp",
				userIds: ["alice"]
			}
		])
	);
const setup = () => {
	const client = {
		callTool: mock(async () => ({ content: [{ text: "Found the docs", type: "text" as const }], isError: false })),
		close: mock(async () => {}),
		experimental_getPrompt: mock(async () => ({
			messages: [{ content: { text: "Summarize", type: "text" as const }, role: "user" as const }]
		})),
		experimental_listPrompts: mock(async () => ({
			prompts: [{ arguments: [{ name: "topic", required: true }], name: "summarize" }]
		})),
		initializeResult: {
			capabilities: { prompts: {}, resources: {}, tools: {} },
			protocolVersion: "2026-07-28",
			serverInfo: { name: "docs", version: "1" }
		},
		listResources: mock(async () => ({ resources: [{ name: "Guide", uri: "docs://guide" }] })),
		listTools: mock(async () => ({
			tools: [
				{ inputSchema: { type: "object" as const }, name: "delete" },
				{
					inputSchema: { properties: { query: { type: "string" } }, required: ["query"], type: "object" as const },
					name: "search"
				}
			]
		})),
		readResource: mock(async () => ({ contents: [{ text: "<script>untrusted</script>", uri: "docs://guide" }] })),
		serverInfo: { name: "docs", version: "1" }
	} satisfies Pick<
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
	const connect = mock(async () => client);
	return { client, connect, service: createMcpService(config(), connect) };
};
const request = { action: "call" as const, argumentsJson: '{"query":"MCP"}', name: "search", serverId: "docs" };
describe("MCP workspace", () => {
	it("keeps credentials private and rejects other users before connecting", async () => {
		const { service, connect } = setup();
		expect(service.list("alice").servers).toEqual([{ description: "", id: "docs", name: "Documentation", toolCount: 1 }]);
		expect(service.list("bob").servers).toEqual([]);
		await expect(service.execute(request, "bob")).rejects.toMatchObject({ status: 404 });
		expect(connect).not.toHaveBeenCalled();
	});
	it("discovers allowed capabilities, disables retries/redirects, and closes", async () => {
		const { service, client, connect } = setup();
		const result = await service.inspect("docs", "alice");
		expect(result.protocolVersion).toBe("2026-07-28");
		expect(result.capabilities.map((entry) => entry.name)).toEqual(["search", "docs://guide", "summarize"]);
		expect(client.close).toHaveBeenCalledTimes(1);
		expect(connect).toHaveBeenCalledWith(
			expect.objectContaining({ maxRetries: 0, transport: expect.objectContaining({ redirect: "error", type: "http" }) })
		);
	});
	it("validates arguments and allowlists before remote execution", async () => {
		const { service, client } = setup();
		await expect(service.execute({ ...request, argumentsJson: '{"query":42}' }, "alice")).rejects.toMatchObject({
			status: 400
		});
		await expect(service.execute({ ...request, name: "delete" }, "alice")).rejects.toMatchObject({ status: 404 });
		expect(client.callTool).not.toHaveBeenCalled();
		expect(client.close).toHaveBeenCalledTimes(2);
		expect((await service.execute(request, "alice")).text).toContain("Found the docs");
		expect(client.callTool).toHaveBeenCalledTimes(1);
	});
	it("previews resources as data and validates required prompt arguments", async () => {
		const { service, client } = setup();
		expect(
			(await service.execute({ ...request, action: "read", argumentsJson: "{}", name: "docs://guide" }, "alice")).text
		).toContain("<script>untrusted</script>");
		await expect(
			service.execute({ ...request, action: "prompt", argumentsJson: "{}", name: "summarize" }, "alice")
		).rejects.toMatchObject({ status: 400 });
		expect(client.experimental_getPrompt).not.toHaveBeenCalled();
		await service.execute({ ...request, action: "prompt", argumentsJson: '{"topic":"MCP"}', name: "summarize" }, "alice");
		expect(client.experimental_getPrompt).toHaveBeenCalledTimes(1);
		expect(McpPreviewSchema.safeParse(request).success).toBe(false);
	});
	it("rejects malformed JSON and cancellation before initialization", async () => {
		const { service, connect } = setup();
		for (const argumentsJson of ["null", "[]", "oops"])
			await expect(service.execute({ ...request, argumentsJson }, "alice")).rejects.toMatchObject({ status: 400 });
		await expect(service.execute(request, "alice", AbortSignal.abort())).rejects.toMatchObject({ status: 504 });
		expect(connect).not.toHaveBeenCalled();
	});
	it("sanitizes remote errors and cleans up failed requests", async () => {
		const { service, client } = setup();
		client.listTools.mockRejectedValueOnce(new Error("Authorization: Bearer secret"));
		await expect(service.inspect("docs", "alice")).rejects.toThrow("The MCP server could not complete this request.");
		expect(client.close).toHaveBeenCalledTimes(1);
	});
	it("bounds output and preserves remote failures without retries", async () => {
		const { service, client } = setup();
		client.callTool.mockResolvedValueOnce({ content: [{ text: "x".repeat(30000), type: "text" }], isError: true });
		const result = await service.execute(request, "alice");
		expect(result.truncated).toBe(true);
		expect(result.isError).toBe(true);
		expect(result.text.length).toBe(24000);
		expect(client.callTool).toHaveBeenCalledTimes(1);
	});
	it("follows catalog pagination", async () => {
		const { client } = setup();
		const listTools = mock(async (options?: Parameters<MCPClient["listTools"]>[0]) =>
			options?.params?.cursor
				? { tools: [{ inputSchema: { type: "object" as const }, name: "search" }] }
				: { nextCursor: "next", tools: [] }
		);
		const result = await createMcpService(config(), async () => ({ ...client, listTools })).inspect("docs", "alice");
		expect(result.capabilities.some((entry) => entry.name === "search")).toBe(true);
		expect(listTools).toHaveBeenCalledTimes(2);
	});
	it("rejects unsafe or ambiguous operator configuration", () => {
		for (const change of [{ url: "http://example.com" }, { url: "https://user:secret@example.com" }, { userIds: [] }])
			expect(() => parseMcpConfig(JSON.stringify([{ ...config()[0], ...change }]))).toThrow(
				"Invalid MCP_SERVERS configuration"
			);
		expect(() => parseMcpConfig(JSON.stringify([...config(), ...config()]))).toThrow("Invalid MCP_SERVERS configuration");
	});
	it("negotiates stateless MCP 2026-07-28 with the real SDK", async () => {
		const methods: string[] = [];
		const wireFetch = Object.assign(
			async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
				const message = JSON.parse(String(init?.body));
				methods.push(message.method);
				const result =
					message.method === "server/discover"
						? { capabilities: { tools: {} }, supportedVersions: ["2026-07-28"] }
						: { tools: [{ inputSchema: { properties: {}, type: "object" }, name: "search" }] };
				return Response.json({ id: message.id, jsonrpc: "2.0", result: { ...result, resultType: "complete" } });
			},
			{ preconnect: fetch.preconnect }
		);
		const service = createMcpService(config(), (options) =>
			createMCPClient({ ...options, transport: { fetch: wireFetch, type: "http", url: "https://fixture.example/mcp" } })
		);
		const result = await service.inspect("docs", "alice");
		expect(result.protocolVersion).toBe("2026-07-28");
		expect(methods).toEqual(["server/discover", "tools/list"]);
	});

	it("uses the real SDK for legacy HTTP initialization and discovery", async () => {
		const methods: string[] = [];
		const wireFetch = Object.assign(
			async (_url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
				const message = JSON.parse(String(init?.body));
				methods.push(message.method);
				if (message.method === "server/discover")
					return Response.json({ error: { code: -32601, message: "Method not found" }, id: message.id, jsonrpc: "2.0" });
				if (message.method === "notifications/initialized") return new Response(null, { status: 202 });
				const result =
					message.method === "initialize"
						? { capabilities: { tools: {} }, protocolVersion: "2025-11-25", serverInfo: { name: "fixture", version: "1" } }
						: { tools: [{ inputSchema: { properties: {}, type: "object" }, name: "search" }] };
				return Response.json({ id: message.id, jsonrpc: "2.0", result });
			},
			{ preconnect: fetch.preconnect }
		);
		const service = createMcpService(config(), (options) =>
			createMCPClient({ ...options, transport: { fetch: wireFetch, type: "http", url: "https://fixture.example/mcp" } })
		);
		const result = await service.inspect("docs", "alice");
		expect(result.protocolVersion).toBe("2025-11-25");
		expect(result.capabilities[0]?.name).toBe("search");
		expect(methods).toContain("initialize");
		expect(methods).toContain("tools/list");
	});
});
