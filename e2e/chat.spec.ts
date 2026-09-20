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
		route.fulfill(json({ data: [{ id: "gpt-5-mini", name: "GPT-5 Mini", provider: "openai" }], message: "ok" })),
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
