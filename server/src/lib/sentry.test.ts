import { describe, expect, it } from "bun:test";

describe("server telemetry privacy", () => {
	// Initialize the real SDK in isolation so its global hooks cannot affect other tests.
	for (const userInfo of [false, true]) {
		it(`keeps private content disabled with the PII opt-in set to ${userInfo}`, async () => {
			const child = Bun.spawn({
				cmd: [
					process.execPath,
					"--no-env-file",
					"--preload",
					"./src/test/setup-env.ts",
					"--eval",
					`
					import * as Sentry from '@sentry/bun';
					import { createApp } from './src/lib/create-app';
					createApp();
					const client = Sentry.getClient();
					if (!client) throw new Error('Sentry was not initialized');
					const options = client.getOptions();
					const event = await options.beforeSend({ request: {
						url: 'https://example.invalid/api/chat',
						cookies: { session: 'private-cookie' },
						headers: { Authorization: 'private-token' },
						data: { password: 'private-password' }
					}}, {});
					process.stdout.write(JSON.stringify({ collection: client.getDataCollectionOptions(), event }));
					await Sentry.close(0);
					`
				],
				cwd: new URL("../../", import.meta.url).pathname,
				env: {
					NODE_ENV: "test",
					PATH: Bun.env.PATH ?? "",
					SENTRY_DSN: "https://public@example.invalid/1",
					SENTRY_SEND_DEFAULT_PII: String(userInfo),
					SENTRY_TRACES_SAMPLE_RATE: "0"
				},
				stderr: "pipe",
				stdout: "pipe"
			});
			const [stdout, stderr, exitCode] = await Promise.all([
				new Response(child.stdout).text(),
				new Response(child.stderr).text(),
				child.exited
			]);
			expect(exitCode, stderr).toBe(0);
			const { collection, event } = JSON.parse(stdout);
			expect(collection).toMatchObject({
				cookies: false,
				databaseQueryData: false,
				genAI: { inputs: false, outputs: false },
				graphQL: { document: false, variables: false },
				httpBodies: [],
				httpHeaders: { request: false, response: false },
				queues: false,
				stackFrameVariables: false,
				urlQueryParams: false,
				userInfo
			});
			expect(event.request.cookies).toBeUndefined();
			expect(event.request.headers.Authorization).toBe("[Filtered]");
			expect(event.request.data.password).toBe("[Filtered]");
		});
	}
});
