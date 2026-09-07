import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";

const image = process.argv[2] ?? "chat-app-server:latest";
const docker = (args) => spawnSync("docker", args, { encoding: "utf8", timeout: 30_000 });
const started = docker([
	"run",
	"--detach",
	"--rm",
	"--network=none",
	"--read-only",
	"--cap-drop=ALL",
	"--security-opt=no-new-privileges:true",
	"--tmpfs=/tmp:size=64m,mode=1777",
	"--env=NODE_ENV=production",
	"--env=SERVER_PORT=3000",
	"--env=BETTER_AUTH_SECRET=ci_startup_test_secret_at_least_32_characters",
	"--env=CLIENT_URL=http://127.0.0.1:8080",
	"--env=DB_URL=postgres://postgres:postgres@127.0.0.1:5432/chatapp",
	"--env=REDIS_URL=redis://127.0.0.1:6379",
	"--env=OPENAI_API_KEY=test-key-no-provider-access",
	image,
]);
if (started.error) throw started.error;
assert.equal(started.status, 0, `Server container did not start: ${started.stderr}`);
const containerId = started.stdout.trim();

try {
	const deadline = Date.now() + 30_000;
	let ready = false;
	while (Date.now() < deadline) {
		const probe = docker([
			"exec",
			containerId,
			"bun",
			"-e",
			`for (const [path, status] of [["health", "ok"], ["ready", "ready"]]) {
				const response = await fetch("http://127.0.0.1:3000/" + path, { signal: AbortSignal.timeout(2000) });
				if (!response.ok || (await response.json()).status !== status) process.exit(1);
			}`,
		]);
		if (probe.status === 0) {
			ready = true;
			break;
		}
		await setTimeout(250);
	}
	if (!ready) {
		const logs = docker(["logs", containerId]);
		throw new Error(`Server health probes failed:\n${logs.stdout}\n${logs.stderr}`);
	}
	console.log("Production server health and readiness passed (non-root, read-only, no network).");
} finally {
	const removed = docker(["rm", "--force", containerId]);
	if (removed.error || removed.status !== 0) {
		console.error(`Could not remove test container: ${removed.error?.message ?? removed.stderr}`);
		process.exitCode = 1;
	}
}
