import { describe, expect, it, mock } from "bun:test";
import type { McpResult } from "@chat-app/shared";
import { generateText } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import { createMcpTool } from "@/lib/mcp";

const input = { action: "call", argumentsJson: '{"query":"MCP"}', name: "search", serverId: "docs" };
const usage = {
	inputTokens: { cacheRead: undefined, cacheWrite: undefined, noCache: 10, total: 10 },
	outputTokens: { reasoning: undefined, text: 5, total: 5 }
};
const secret = "mcp-approval-test-secret-at-least-32-characters";
const callModel = new MockLanguageModelV3({
	doGenerate: async () => ({
		content: [{ input: JSON.stringify(input), toolCallId: "call-1", toolName: "mcp", type: "tool-call" }],
		finishReason: { raw: "tool_calls", unified: "tool-calls" },
		usage,
		warnings: []
	})
});
const finalModel = new MockLanguageModelV3({
	doGenerate: async () => ({
		content: [{ text: "Done", type: "text" }],
		finishReason: { raw: "stop", unified: "stop" },
		usage,
		warnings: []
	})
});

describe("MCP chat approval", () => {
	for (const approved of [false, true])
		it(`${approved ? "executes once after approval" : "does not execute after denial"} and uses server-owned identity`, async () => {
			const execute = mock(
				async (): Promise<McpResult> => ({
					action: "call",
					durationMs: 2,
					isError: false,
					name: "search",
					serverId: "docs",
					text: "Found the docs",
					truncated: false
				})
			);
			const tools = { mcp: createMcpTool("alice", { execute }) };
			const pending = await generateText({
				experimental_toolApprovalSecret: secret,
				model: callModel,
				prompt: "Search the docs",
				tools
			});
			expect(execute).not.toHaveBeenCalled();
			const approval = pending.content.find((part) => part.type === "tool-approval-request");
			if (approval?.type !== "tool-approval-request") throw new Error("Expected signed MCP approval request");
			expect(approval.signature).toBeTruthy();
			await generateText({
				experimental_toolApprovalSecret: secret,
				messages: [
					...pending.response.messages,
					{ content: [{ approvalId: approval.approvalId, approved, type: "tool-approval-response" }], role: "tool" }
				],
				model: finalModel,
				tools
			});
			expect(execute).toHaveBeenCalledTimes(approved ? 1 : 0);
			if (approved) expect(execute).toHaveBeenCalledWith(input, "alice", undefined);
		});
});

it("rejects a changed tool input after an approval was signed", async () => {
	const execute = mock(
		async (): Promise<McpResult> => ({
			action: "call",
			durationMs: 1,
			isError: false,
			name: "search",
			serverId: "docs",
			text: "Found",
			truncated: false
		})
	);
	const tools = { mcp: createMcpTool("alice", { execute }) };
	const pending = await generateText({
		experimental_toolApprovalSecret: secret,
		model: callModel,
		prompt: "Search",
		tools
	});
	const approval = pending.content.find((part) => part.type === "tool-approval-request");
	if (approval?.type !== "tool-approval-request") throw new Error("Expected approval");
	const messages = structuredClone(pending.response.messages);
	for (const message of messages)
		if (message.role === "assistant" && Array.isArray(message.content)) {
			for (const part of message.content) if (part.type === "tool-call") part.input = { ...input, name: "delete" };
		}
	await expect(
		generateText({
			experimental_toolApprovalSecret: secret,
			messages: [
				...messages,
				{ content: [{ approvalId: approval.approvalId, approved: true, type: "tool-approval-response" }], role: "tool" }
			],
			model: finalModel,
			tools
		})
	).rejects.toThrow("signature verification failed");
	expect(execute).not.toHaveBeenCalled();
});
