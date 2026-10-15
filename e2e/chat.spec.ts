import { expect, type Page, test } from "@playwright/test";

const user = {
	email: "e2e@example.com",
	id: "00000000-0000-0000-0000-000000000001",
	image: null,
	name: "E2E User",
};

const conversation = {
	createdAt: "2026-07-14T00:00:00.000Z",
	id: "chat-e2e",
	messages: [],
	title: "E2E conversation",
	updatedAt: "2026-07-14T00:00:00.000Z",
};

const json = (body: unknown, status = 200) => ({ body: JSON.stringify(body), contentType: "application/json", status });

async function mockAuthenticatedApp(
	page: Page,
	options: { answer?: string; conversations?: Array<typeof conversation> } = {},
) {
	const conversations = options.conversations ?? [];
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill(
			json({
				session: { expiresAt: "2099-01-01T00:00:00.000Z", id: "session-e2e", token: "current-test-token", userId: user.id },
				user,
			}),
		),
	);
	await page.route("**/api/ai/models", (route) =>
		route.fulfill(
			json({ data: [{ id: "openai/gpt-5-mini", name: "GPT-5 Mini", provider: "vercel-ai-gateway" }], message: "ok" }),
		),
	);
	await page.route("**/api/conversations", async (route) => {
		if (route.request().method() === "POST") {
			await route.fulfill(json({ data: conversation, message: "created" }, 201));
			return;
		}
		await route.fulfill(json({ data: conversations, message: "ok" }));
	});
	await page.route("**/api/conversations/chat-e2e", async (route) => {
		if (route.request().method() === "DELETE") {
			await route.fulfill(json({ data: { id: conversation.id }, message: "deleted" }));
			return;
		}
		await route.fulfill(json({ data: conversation, message: "ok" }));
	});
	await page.route("**/api/ai/text-stream", (route) =>
		route.fulfill({
			body: [
				'data: {"type":"start","messageId":"msg_assistant"}',
				'data: {"type":"text-start","id":"text-1"}',
				`data: ${JSON.stringify({ delta: options.answer ?? "Production-ready answer", id: "text-1", type: "text-delta" })}`,
				'data: {"type":"text-end","id":"text-1"}',
				'data: {"type":"finish"}',
				"data: [DONE]",
				"",
			].join("\n\n"),
			contentType: "text/event-stream",
			headers: { "x-vercel-ai-ui-message-stream": "v1" },
			status: 200,
		}),
	);
	await page.route("https://svgl.app/**", (route) => route.abort());
}

test.afterEach(async ({ page }) => {
	expect(await page.pageErrors()).toEqual([]);
});

test("loads rich answer renderers in the production bundle", async ({ page }, testInfo) => {
	await mockAuthenticatedApp(page, {
		answer:
			"Here is a small example.\n\n```javascript\nconst answer = 42;\n```\n\n$$x^2 + y^2 = z^2$$\n\n```mermaid\ngraph TD\n  A[Question] --> B[Answer]\n```",
	});
	await page.goto("/chat");
	await page.getByLabel("Prompt").fill("Show code, math, and a diagram");
	await page.getByRole("button", { name: "Start conversation" }).click();

	await expect(page.locator("pre").filter({ hasText: "const answer = 42;" })).toBeVisible();
	await expect(page.locator(".katex")).toBeVisible();
	// KaTeX 0.18 prefixes internal classes; markup and lazy-loaded CSS must agree.
	await expect(page.locator(".katex .katex-base").first()).toBeVisible();
	await expect(page.locator(".katex .katex-base").first()).toHaveCSS("display", "inline-block");
	await expect(page.locator(".katex-mathml")).toHaveCSS("position", "absolute");
	await expect(page.locator('svg[id^="mermaid"]')).toBeVisible();
	await expect(page.locator("body")).toHaveJSProperty(
		"scrollWidth",
		await page.locator("body").evaluate((body) => body.clientWidth),
	);
	await page.screenshot({ fullPage: true, path: testInfo.outputPath("rich-answer.png") });
});

test("redirects an unauthenticated visitor to login", async ({ page }) => {
	await page.route("**/api/auth/get-session", (route) => route.fulfill(json({ message: "Unauthorized" }, 401)));
	await page.goto("/chat");

	await expect(page).toHaveURL(/\/login/);
	await expect(page).toHaveTitle("ChatFlow");
	await expect(page.getByRole("img", { name: "ChatFlow" })).toBeVisible();
	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("enforces the current password minimum before registration", async ({ page }) => {
	await page.route("**/api/auth/get-session", (route) => route.fulfill(json({ message: "Unauthorized" }, 401)));
	await page.goto("/register");

	await page.getByLabel("Full Name").fill("Test Person");
	await page.getByLabel("Email address").fill("test@example.com");
	await page.getByLabel("Password", { exact: true }).fill("1234567");
	await page.getByLabel("Confirm Password").fill("1234567");
	await page.getByRole("button", { name: "Create account" }).click();

	await expect(
		page.getByRole("main").getByText("Password must be at least 8 characters", { exact: true }),
	).toBeVisible();
});

test("creates a conversation from a prompt and completes a streamed response", async ({ page }) => {
	await mockAuthenticatedApp(page);
	await page.goto("/chat");

	await expect(page.getByRole("heading", { name: "What’s on your mind?" })).toBeVisible();
	await page.getByLabel("Prompt").fill("Build a resilient AI platform");
	await page.getByRole("button", { name: "Start conversation" }).click();

	await expect(page).toHaveURL(/\/chat\/chat-e2e/);
	await expect(page.locator(".is-user").getByText("Build a resilient AI platform", { exact: true })).toBeVisible();
	await expect(page.getByText("Production-ready answer")).toBeVisible();
});

test("deletes the current conversation through the confirmation flow", async ({ page }) => {
	await mockAuthenticatedApp(page, { conversations: [conversation] });
	await page.goto("/chat/chat-e2e");

	if ((page.viewportSize()?.width ?? 1280) < 768) {
		await page.getByRole("button", { name: "Open navigation sidebar" }).click();
	}
	await page.getByRole("button", { name: /delete e2e conversation/i }).click();
	await expect(page.getByRole("dialog", { name: "Delete conversation?" })).toBeVisible();
	await page.getByRole("button", { name: "Delete" }).click();

	await expect(page).toHaveURL(/\/chat\/?$/);
	await expect(page.getByRole("heading", { name: "What’s on your mind?" })).toBeVisible();
});

test("recovers from a failed AI request without duplicating the user message", async ({ page }) => {
	await mockAuthenticatedApp(page);
	await page.route("**/api/ai/text-stream", (route) => route.fulfill(json({ message: "Internal server error" }, 500)), {
		times: 1,
	});
	await page.goto("/chat");
	await page.getByLabel("Prompt").fill("Help me recover this conversation");
	await page.getByRole("button", { name: "Start conversation" }).click();

	await expect(page.getByText("The assistant could not finish that response.", { exact: false })).toBeVisible();
	const retriedRequest = page.waitForRequest("**/api/ai/text-stream");
	await page.getByRole("button", { exact: true, name: "Retry" }).click();
	expect((await retriedRequest).postDataJSON()).toMatchObject({
		chatId: conversation.id,
		trigger: "regenerate-message",
	});
	await expect(page.getByText("Production-ready answer")).toBeVisible();
	await expect(page.locator(".is-user")).toHaveCount(1);
	await expect(page.getByRole("button", { exact: true, name: "Retry" })).toHaveCount(0);
});

test("shows the refreshed empty state without horizontal overflow", async ({ page }, testInfo) => {
	await mockAuthenticatedApp(page);
	await page.goto("/chat");
	await expect(page.getByRole("heading", { name: "What’s on your mind?" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Start conversation" })).toBeDisabled();
	await expect(page.locator("body")).toHaveJSProperty(
		"scrollWidth",
		await page.locator("body").evaluate((body) => body.clientWidth),
	);
	await page.screenshot({ fullPage: true, path: testInfo.outputPath("chat-home.png") });
});

test("retries session loading and revocation while preserving the current device", async ({ page }, testInfo) => {
	await mockAuthenticatedApp(page);
	await page.route("**/api/ai/usage", (route) =>
		route.fulfill(
			json({
				data: {
					ai: { requests: { limit: 200, used: 0 }, tokens: { limit: 1000000, used: 0 } },
					embedding: { storageBytes: { limit: 1000000, used: 0 }, tokens: { limit: 1000000, used: 0 } },
					resetsAt: "2099-01-01T00:00:00.000Z",
				},
			}),
		),
	);
	const makeSession = (id: string, token: string) => ({
		createdAt: "2026-09-20T00:00:00.000Z",
		expiresAt: "2099-01-01T00:00:00.000Z",
		id,
		token,
		updatedAt: "2026-09-20T00:00:00.000Z",
		userAgent: "Test browser",
		userId: user.id,
	});
	let sessions = [makeSession("session-e2e", "current-test-token"), makeSession("other-session", "other-test-token")];
	let loadFails = true;
	await page.route("**/api/auth/list-sessions", (route) =>
		route.fulfill(loadFails ? json({ message: "Unavailable" }, 503) : json(sessions)),
	);
	await page.route("**/api/auth/revoke-other-sessions", async (route) => {
		sessions = sessions.slice(0, 1);
		await route.fulfill(json({ status: true }));
	});
	await page.route("**/api/auth/revoke-session", (route) => route.fulfill(json({ message: "Unavailable" }, 503)));
	await page.goto("/profile");
	await expect(page.getByText("Could not load your sessions.")).toBeVisible({ timeout: 20000 });
	loadFails = false;
	await page.getByRole("button", { exact: true, name: "Try again" }).click();
	await expect(page.getByRole("listitem").filter({ hasText: "This device" })).toBeVisible();
	await expect(page.getByText("Other device", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: /^Sign out session from/ }).click();
	await expect(page.getByText("Could not sign out this session. Please try again.")).toBeVisible();
	await expect(page.getByText("Other device", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "Sign out other devices" }).click();
	await expect(page.getByText("Other device", { exact: true })).toHaveCount(0);
	await expect(page.getByRole("listitem").filter({ hasText: "This device" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Sign out other devices" })).toBeDisabled();
	await page.screenshot({ fullPage: true, path: testInfo.outputPath("profile-sessions.png") });
});
test("evaluates editable Jev questions and displays distributions", async ({ page }) => {
	await mockAuthenticatedApp(page);
	await page.route("**/api/jev/status", (route) => route.fulfill(json({ configured: true, model: "typesafe-ai/jev" })));
	let submitted: unknown;
	await page.route("**/api/jev/evaluate", async (route) => {
		submitted = route.request().postDataJSON();
		await route.fulfill(
			json({
				answers: {
					department: {
						choice: "technical",
						confidence: 0.86,
						probabilities: { billing: 0.07, other: 0.02, technical: 0.91 },
						type: "choice",
					},
					impact: {
						confidence: 0.65,
						probabilities: { "0": 0.01, "1": 0.09, "2": 0.4, "3": 0.5 },
						score: 2.4,
						type: "score",
					},
					refund: { probability: 0.12, type: "boolean" },
				},
				durationMs: 42,
				model: "typesafe-ai/jev",
				usage: { inputTokens: 420, outputTokens: 10, totalTokens: 430 },
			}),
		);
	});
	await page.goto("/chat/jev");
	await expect(page.getByRole("heading", { name: "Jev Studio" })).toBeVisible();
	await expect(page.getByText("Gateway key configured")).toBeVisible();
	await page.getByRole("button", { name: "Run evaluation" }).click();
	await expect(page.locator("strong").filter({ hasText: "technical" })).toBeVisible();
	await expect(page.getByText("91%")).toBeVisible();
	await expect(page.getByText("Confidence: 86%", { exact: true })).toBeVisible();
	await expect(page.getByText("Needs review", { exact: true })).toBeVisible();
	expect(submitted).toMatchObject({
		questions: [
			{ id: "department", type: "choice" },
			{ id: "impact", type: "score" },
			{ id: "refund", type: "boolean" },
		],
		stateFormat: "text",
	});
});

test("keeps Jev templates available when the Gateway key is missing", async ({ page }) => {
	await mockAuthenticatedApp(page);
	await page.route("**/api/jev/status", (route) => route.fulfill(json({ configured: false, model: "typesafe-ai/jev" })));
	await page.goto("/chat/jev");
	await expect(page.getByRole("heading", { name: "Jev Studio" })).toBeVisible();
	await expect(page.getByText("add AI_GATEWAY_API_KEY to the server environment")).toBeVisible();
	await expect(page.getByRole("button", { name: "Run evaluation" })).toBeDisabled();
	await page.getByRole("button", { name: /Answer checking/ }).click();
	await expect(page.getByLabel("State format")).toHaveValue("json");
	await expect(page.getByLabel("Question 1 name")).toHaveValue("supported");
});

const mcpCapabilities = [
	{
		description: "Find reliable answers across your team's documentation.",
		inputSchema: { properties: { query: { type: "string" } }, required: ["query"], type: "object" },
		kind: "tool",
		name: "search_docs",
		title: "Search documentation",
	},
	{
		description: "The current deployment checklist and operational notes.",
		kind: "resource",
		name: "docs://guide",
		title: "Deployment guide",
	},
	{
		arguments: [{ description: "What would you like to investigate?", name: "topic", required: true }],
		description: "A reusable outline for an evidence-based research brief.",
		kind: "prompt",
		name: "brief",
		title: "Research brief",
	},
];
async function mockMcp(
	page: Page,
	servers = [
		{ description: "Shared knowledge for better answers", id: "docs", name: "Team documentation", toolCount: 1 },
	],
) {
	await mockAuthenticatedApp(page);
	await page.route("**/api/mcp/servers", (route) => route.fulfill(json({ servers })));
	await page.route("**/api/mcp/inspect", (route) =>
		route.fulfill(
			json({
				capabilities: mcpCapabilities,
				durationMs: 82,
				protocolVersion: "2026-07-28",
				serverId: "docs",
				serverVersion: "1",
				truncated: false,
			}),
		),
	);
	await page.route("**/api/mcp/preview", (route) => {
		const request: { action: string; name: string } = route.request().postDataJSON();
		return route.fulfill(
			json({
				action: request.action,
				durationMs: 18,
				isError: false,
				name: request.name,
				serverId: "docs",
				text: "<script>window.mcpInjected = true</script>\nDeployment checklist",
				truncated: false,
			}),
		);
	});
}

test("MCP workspace discovers, filters, previews and hands off to chat", async ({ page }, testInfo) => {
	await mockMcp(page);
	let inspections = 0;
	page.on("request", (request) => {
		if (request.url().endsWith("/mcp/inspect")) inspections++;
	});
	await page.goto("/chat/mcp");
	await expect(page.getByRole("heading", { name: "MCP workspace" })).toBeVisible();
	expect(inspections).toBe(0);
	await page.getByRole("button", { name: "Discover capabilities" }).click();
	await expect(page.getByText(/Last check succeeded/)).toBeVisible();
	await page.getByLabel("Search capabilities").fill("no such capability");
	await expect(page.getByText("No capabilities match your search.")).toBeVisible();
	await page.getByLabel("Search capabilities").fill("");
	await page.getByRole("button", { exact: true, name: "Resources 1" }).click();
	await page.getByRole("button", { exact: true, name: "Read resource" }).click();
	await expect(page.locator("pre").filter({ hasText: "Deployment checklist" })).toBeVisible();
	expect(await page.evaluate(() => "mcpInjected" in window)).toBe(false);
	await page.getByRole("button", { exact: true, name: "Prompts 1" }).click();
	await expect(page.getByRole("button", { name: "Preview prompt" })).toBeDisabled();
	await page.getByLabel("topic (required)").fill("MCP architecture");
	await expect(page.getByRole("button", { name: "Preview prompt" })).toBeEnabled();
	await page.getByRole("button", { exact: true, name: "Tools 1" }).click();
	await page.getByText("Input schema", { exact: true }).click();
	await expect(page.locator("pre").filter({ hasText: '"query"' })).toBeVisible();
	await expect(page.locator("body")).toHaveJSProperty(
		"scrollWidth",
		await page.locator("body").evaluate((body) => body.clientWidth),
	);
	await page.screenshot({ fullPage: true, path: testInfo.outputPath("mcp-workspace.png") });
	await page.getByRole("button", { name: "Use in chat" }).click();
	await expect(page).toHaveURL(/\/chat\/chat-e2e/);
	await expect(page.getByLabel("Toggle MCP connections")).toHaveAttribute("aria-pressed", "true");
	await expect(page.getByLabel("Prompt")).toHaveValue(/search_docs/);
});

test("MCP workspace explains empty connections and recovers from a failed check", async ({ page }) => {
	await mockMcp(page, []);
	await page.goto("/chat/mcp");
	await expect(page.getByRole("heading", { name: "Your next connection starts here" })).toBeVisible();
	await page.route("**/api/mcp/servers", (route) =>
		route.fulfill(json({ servers: [{ description: "", id: "docs", name: "Team documentation", toolCount: 1 }] })),
	);
	await page.getByRole("button", { name: "Check again" }).click();
	await page.route("**/api/mcp/inspect", (route) =>
		route.fulfill(json({ message: "Connection timed out. Try again." }, 504)),
	);
	await page.getByRole("button", { name: "Discover capabilities" }).click();
	await expect(page.getByRole("alert")).toContainText("Connection timed out");
	await page.route("**/api/mcp/inspect", (route) =>
		route.fulfill(
			json({
				capabilities: [],
				durationMs: 2,
				protocolVersion: "2026-07-28",
				serverId: "docs",
				serverVersion: "1",
				truncated: false,
			}),
		),
	);
	await page.getByRole("button", { name: "Discover capabilities" }).click();
	await expect(page.getByText(/No allowed capabilities were advertised/)).toBeVisible();
});

test("MCP prompt handoff preserves arguments and selected preview outside the URL", async ({ page }, testInfo) => {
	await mockMcp(page);
	await page.goto("/chat/mcp");
	await page.getByRole("button", { name: "Discover capabilities" }).click();
	await page.getByRole("button", { exact: true, name: "Prompts 1" }).click();
	await page.getByLabel("topic (required)").fill("Private release planning");
	await page.getByRole("button", { name: "Preview prompt" }).click();
	await expect(page.getByText("Deployment checklist", { exact: false })).toBeVisible();
	await page.getByLabel("Include this preview in the chat draft").check();
	await page.screenshot({ fullPage: true, path: testInfo.outputPath("mcp-preview-draft.png") });
	await page.getByRole("button", { name: "Use in chat" }).click();
	await expect(page.getByLabel("Prompt")).toHaveValue(/Private release planning/);
	await expect(page.getByLabel("Prompt")).toHaveValue(/Deployment checklist/);
	expect(page.url()).not.toContain("Private");
	expect(page.url()).not.toContain("prompt=");
	expect(await page.evaluate(() => "mcpInjected" in window)).toBe(false);
	await expect(page.getByLabel("Toggle MCP connections")).toHaveAttribute("aria-pressed", "true");
});

test("MCP discovery and previews can be cancelled and restarted", async ({ page }) => {
	await mockMcp(page);
	let finishDiscovery: (() => void) | undefined;
	await page.route("**/api/mcp/inspect", async (route) => {
		await new Promise<void>((resolve) => {
			finishDiscovery = resolve;
		});
		await route
			.fulfill(
				json({
					capabilities: mcpCapabilities,
					durationMs: 82,
					protocolVersion: "2026-07-28",
					serverId: "docs",
					serverVersion: "1",
					truncated: false,
				}),
			)
			.catch(() => {});
	});
	await page.goto("/chat/mcp");
	await page.getByRole("button", { name: "Discover capabilities" }).click();
	await page.getByRole("button", { name: "Cancel discovery" }).click();
	await expect(page.getByRole("status")).toContainText("Discovery cancelled");
	finishDiscovery?.();
	await page.unroute("**/api/mcp/inspect");
	await page.route("**/api/mcp/inspect", (route) =>
		route.fulfill(
			json({
				capabilities: mcpCapabilities,
				durationMs: 82,
				protocolVersion: "2026-07-28",
				serverId: "docs",
				serverVersion: "1",
				truncated: false,
			}),
		),
	);
	await page.getByRole("button", { name: "Discover capabilities" }).click();
	await page.getByRole("button", { exact: true, name: "Resources 1" }).click();
	let finishPreview: (() => void) | undefined;
	await page.route("**/api/mcp/preview", async (route) => {
		await new Promise<void>((resolve) => {
			finishPreview = resolve;
		});
		await route
			.fulfill(
				json({
					action: "read",
					durationMs: 18,
					isError: false,
					name: "docs://guide",
					serverId: "docs",
					text: "Late preview",
					truncated: false,
				}),
			)
			.catch(() => {});
	});
	await page.getByRole("button", { exact: true, name: "Read resource" }).click();
	await page.getByRole("button", { name: "Cancel preview" }).click();
	await expect(page.getByRole("status")).toContainText("Preview cancelled");
	finishPreview?.();
	await expect(page.getByText("Late preview", { exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { exact: true, name: "Read resource" })).toBeEnabled();
});
