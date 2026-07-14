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

async function mockAuthenticatedApp(page: Page, options: { conversations?: Array<typeof conversation> } = {}) {
	const conversations = options.conversations ?? [];
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill(json({ session: { expiresAt: "2099-01-01T00:00:00.000Z", id: "session-e2e", userId: user.id }, user })),
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
				'data: {"type":"text-delta","id":"text-1","delta":"Production-ready answer"}',
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

test("redirects an unauthenticated visitor to login", async ({ page }) => {
	await page.route("**/api/auth/get-session", (route) => route.fulfill(json({ message: "Unauthorized" }, 401)));
	await page.goto("/chat");

	await expect(page).toHaveURL(/\/login/);
	await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("creates a conversation from a prompt and completes a streamed response", async ({ page }) => {
	await mockAuthenticatedApp(page);
	await page.goto("/chat");

	await expect(page.getByRole("heading", { name: "What should we improve first?" })).toBeVisible();
	await page.getByLabel("Prompt").fill("Build a resilient AI platform");
	await page.getByRole("button", { name: "Start conversation" }).click();

	await expect(page).toHaveURL(/\/chat\/chat-e2e/);
	await expect(page.getByText("Build a resilient AI platform")).toBeVisible();
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
	await expect(page.getByRole("heading", { name: "What should we improve first?" })).toBeVisible();
});
