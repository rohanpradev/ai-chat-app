import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	fullyParallel: true,
	outputDir: "test-results/playwright",
	projects: [
		{ name: "chromium", use: { ...devices["Desktop Chrome"] } },
		{ name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
	],
	reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report" }]] : "list",
	retries: process.env.CI ? 2 : 0,
	testDir: "./e2e",
	timeout: 30_000,
	use: {
		baseURL: "http://127.0.0.1:4173",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
		video: "retain-on-failure",
	},
	webServer: {
		command: "bun run build:client && bun run --filter @chat-app/client serve -- --host 127.0.0.1 --port 4173",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
		url: "http://127.0.0.1:4173",
	},
	workers: process.env.CI ? 2 : undefined,
});
