import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const context = process.argv[2];
if (!context || context.startsWith("-")) {
	throw new Error("Usage: node scripts/check-k8s-runtime.mjs <local-or-test-kube-context>");
}
const gatewayService = process.env.K8S_TEST_GATEWAY_SERVICE;
const gatewayNamespace = process.env.K8S_TEST_GATEWAY_NAMESPACE ?? "traefik";
const rootDir = new URL("..", import.meta.url);
const namespace = `chat-app-test-${randomUUID().slice(0, 8)}`;
const release = "chat-app";
const imageTag = process.env.K8S_TEST_IMAGE_TAG ?? "latest";
const kubeArgs = ["--context", context, "--namespace", namespace];
const helmArgs = ["--kube-context", context, "--namespace", namespace];
let namespaceCreated = false;
let forward;

const run = (command, args, { capture = false, optional = false } = {}) => {
	const result = spawnSync(command, args, {
		cwd: rootDir,
		encoding: "utf8",
		stdio: capture ? "pipe" : "inherit",
		timeout: 660_000,
	});
	if (!optional && (result.error || result.status !== 0)) {
		throw new Error(`${command} ${args[0]} failed: ${result.error?.message ?? result.status}`);
	}
	return result.stdout?.trim();
};

const portForward = () =>
	new Promise((resolve, reject) => {
		forward = spawn(
			"kubectl",
			[
				"--context",
				context,
				"--namespace",
				gatewayService ? gatewayNamespace : namespace,
				"port-forward",
				`service/${gatewayService ?? "chat-app-client"}`,
				gatewayService ? ":80" : ":8080",
				"--address",
				"127.0.0.1",
			],
			{
				cwd: rootDir,
				stdio: ["ignore", "pipe", "pipe"],
			},
		);
		const timer = setTimeout(() => reject(new Error("Port forwarding timed out")), 30_000);
		let output = "";
		forward.stdout.on("data", (chunk) => {
			output += chunk.toString();
			const match = output.match(/Forwarding from 127\.0\.0\.1:(\d+)/);
			if (match) {
				clearTimeout(timer);
				resolve(`http://localhost:${match[1]}`);
			}
		});
		forward.stderr.resume();
		forward.once("error", (error) => {
			clearTimeout(timer);
			reject(error);
		});
		forward.once("exit", () => {
			clearTimeout(timer);
			reject(new Error("Port forwarding exited"));
		});
	});

try {
	console.log(`Testing context ${context} in disposable namespace ${namespace}`);
	// A create failure must never result in deleting somebody else's namespace.
	run("kubectl", ["--context", context, "create", "namespace", namespace]);
	namespaceCreated = true;
	run("helm", [
		"install",
		release,
		"helm/chat-app",
		...helmArgs,
		"-f",
		"helm/chat-app/values.test.yaml",
		...(gatewayService
			? [
					"--set",
					"exposure.gateway.enabled=true",
					"--set",
					"exposure.gateway.create=true",
					"--set",
					`exposure.gateway.namespace=${namespace}`,
					"--set",
					"exposure.gateway.tls.enabled=false",
					"--set",
					"exposure.gateway.hostnames[0]=localhost",
					"--set",
					"exposure.gateway.cors.allowOrigins[0]=http://localhost",
				]
			: []),
		"--set-string",
		`images.client.tag=${imageTag}`,
		"--set-string",
		`images.server.tag=${imageTag}`,
		"--set-string",
		`images.migrate.tag=${imageTag}`,
		"--wait",
		"--wait-for-jobs",
		"--timeout",
		"10m",
	]);
	run("helm", ["test", release, ...helmArgs, "--timeout", "3m", "--logs"]);
	if (gatewayService) {
		run("kubectl", [...kubeArgs, "wait", "--for=condition=Programmed", "gateway/traefik-gateway", "--timeout=90s"]);
	}
	const baseUrl = await portForward();
	const request = async (path, { method = "GET", body, cookie, status = 200 } = {}) => {
		const response = await fetch(`${baseUrl}${path}`, {
			body: body ? JSON.stringify(body) : undefined,
			headers: {
				Origin: "http://localhost",
				...(body ? { "Content-Type": "application/json" } : {}),
				...(cookie ? { Cookie: cookie } : {}),
			},
			method,
			signal: AbortSignal.timeout(20_000),
		});
		// Do not print authentication responses or cookies on failure.
		assert.equal(response.status, status, `${method} ${path} status`);
		return response;
	};
	if (gatewayService) {
		const deadline = Date.now() + 30_000;
		let ready = false;
		while (Date.now() < deadline) {
			const response = await fetch(`${baseUrl}/api/ready`, {
				redirect: "manual",
				signal: AbortSignal.timeout(5000),
			});
			if (response.status === 200 && (await response.json()).status === "ready") {
				ready = true;
				break;
			}
			await response.body?.cancel();
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
		assert.ok(ready, "Gateway routes must become ready within 30 seconds");
	}
	assert.match(await (await request("/")).text(), /<html/i);
	assert.equal((await (await request("/api/ready")).json()).status, "ready");
	await request("/api/conversations", { status: 401 });
	const credentials = { email: "runtime-test@example.invalid", password: "Runtime-test-password-2026!" };
	await request("/api/auth/sign-up/email", { body: { ...credentials, name: "Runtime Test" }, method: "POST" });
	const signIn = await request("/api/auth/sign-in/email", { body: credentials, method: "POST" });
	const cookie = signIn.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
	assert.ok(cookie, "Sign-in must issue a session cookie");
	assert.equal((await (await request("/api/auth/get-session", { cookie })).json()).user.email, credentials.email);
	const secondSignIn = await request("/api/auth/sign-in/email", { body: credentials, method: "POST" });
	const secondCookie = secondSignIn.headers
		.getSetCookie()
		.map((value) => value.split(";")[0])
		.join("; ");
	const secondSession = await (await request("/api/auth/get-session", { cookie: secondCookie })).json();
	const sessions = await (await request("/api/auth/list-sessions", { cookie })).json();
	assert.ok(sessions.length >= 2, "Separate sign-ins must have independent sessions");
	await request("/api/auth/revoke-session", { body: { token: secondSession.session.token }, cookie, method: "POST" });
	await request("/api/conversations", { cookie: secondCookie, status: 401 });
	await request("/api/auth/revoke-other-sessions", { body: {}, cookie, method: "POST" });
	assert.equal((await (await request("/api/auth/list-sessions", { cookie })).json()).length, 1);
	const created = await (
		await request("/api/conversations", {
			body: { title: "Runtime persistence test" },
			cookie,
			method: "POST",
			status: 201,
		})
	).json();
	assert.ok(created.data.id, "Conversation must have an ID");
	const conversationPath = `/api/conversations/${created.data.id}`;
	assert.equal((await (await request(conversationPath, { cookie })).json()).data.title, "Runtime persistence test");
	const oldPods = run(
		"kubectl",
		[...kubeArgs, "get", "pods", "-l", "app.kubernetes.io/component=server", "-o", "name"],
		{ capture: true },
	);
	assert.ok(oldPods, "API pods must exist before restart");
	// Restart the API: a second pod must read the same session and conversation.
	run("kubectl", [...kubeArgs, "rollout", "restart", "deployment/chat-app-server"]);
	run("kubectl", [...kubeArgs, "rollout", "status", "deployment/chat-app-server", "--timeout=180s"]);
	run("kubectl", [...kubeArgs, "wait", "--for=delete", ...oldPods.split("\n"), "--timeout=90s"]);
	for (let i = 0; i < 10; i++) {
		assert.equal((await (await request(conversationPath, { cookie })).json()).data.title, "Runtime persistence test");
	}
	await request(conversationPath, { cookie, method: "DELETE" });
	await request(conversationPath, { cookie, status: 404 });
	await request("/api/auth/sign-out", { body: {}, cookie, method: "POST" });
	await request("/api/conversations", { cookie, status: 401 });
	const vector = run(
		"kubectl",
		[
			...kubeArgs,
			"exec",
			"statefulset/chat-app-db",
			"--",
			"psql",
			"-U",
			"postgres",
			"-d",
			"chatapp",
			"-Atc",
			"SELECT extversion FROM pg_extension WHERE extname = 'vector'",
		],
		{ capture: true },
	);
	assert.equal(vector, "0.8.6", "pgvector extension version");
	const redis = run("kubectl", [...kubeArgs, "exec", "statefulset/chat-app-redis", "--", "redis-cli", "ping"], {
		capture: true,
	});
	assert.equal(redis, "PONG", "Redis authentication and connectivity");
	console.log(
		"Kubernetes runtime checks passed: nginx, API, migrations, registration, login, session revocation, durable sessions/conversations, logout, pgvector, Redis.",
	);
} catch (error) {
	if (namespaceCreated) {
		if (gatewayService)
			run("kubectl", [...kubeArgs, "get", "gateways,httproutes,middlewares", "-o", "yaml"], { optional: true });
		run("kubectl", [...kubeArgs, "get", "pods,jobs,pvc"], { optional: true });
		run("kubectl", [...kubeArgs, "get", "events", "--field-selector", "type=Warning"], { optional: true });
	}
	throw error;
} finally {
	forward?.kill();
	if (namespaceCreated) {
		run("kubectl", ["--context", context, "delete", "namespace", namespace, "--wait=false"]);
	}
}
