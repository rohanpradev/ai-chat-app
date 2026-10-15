import { describe, expect, it } from "vitest";
import { buildMcpDraft, mcpDraftKey } from "@/lib/mcp-draft";

const server = { id: "docs", name: "Docs", description: "", toolCount: 1 };
const capability = { kind: "prompt" as const, name: "brief", title: "Brief", description: "" };
const preview = {
  serverId: "docs",
  name: "brief",
  action: "prompt",
  text: "Source content",
  isError: false,
  truncated: false,
  durationMs: 10,
};

describe("MCP chat drafts", () => {
  it("keeps entered arguments and labels selected external context", () => {
    const draft = buildMcpDraft({ server, capability, args: { topic: "Release plan" }, preview });
    expect(draft).toContain('"topic": "Release plan"');
    expect(draft).toContain("untrusted reference content");
    expect(draft).toContain("Source content");
    expect(draft).toMatch(/My task: $/);
  });
  it("does not include another connection's result or a failed preview", () => {
    for (const changes of [{ serverId: "other" }, { name: "other" }, { isError: true }]) {
      expect(buildMcpDraft({ server, capability, args: {}, preview: { ...preview, ...changes } })).not.toContain(
        "Source content",
      );
    }
  });
  it("bounds selected context and makes truncation explicit", () => {
    const draft = buildMcpDraft({ server, capability, args: {}, preview: { ...preview, text: "x".repeat(24000) } });
    expect(draft.length).toBeLessThan(13000);
    expect(draft).toContain("[Preview truncated]");
  });
  it("isolates in-memory drafts by account and conversation", () => {
    expect(mcpDraftKey("alice", "one")).not.toEqual(mcpDraftKey("bob", "one"));
    expect(mcpDraftKey("alice", "one")).not.toEqual(mcpDraftKey("alice", "two"));
  });
});
