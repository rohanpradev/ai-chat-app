import { afterEach, expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtures = [];
const source = new URL("..", import.meta.url);
const validEnv =
	"AI_GATEWAY_API_KEY=fixture-gateway\nBETTER_AUTH_SECRET=fixture_secret_with_at_least_32_chars\nDB_PASSWORD=fixture_db_password\nDOMAIN=custom.localhost\nBASE_API_SLUG=v1\nMAKEFILE_FIXTURE_VALUE=selected\n";
const fixture = () => {
	const root = realpathSync(mkdtempSync(join(tmpdir(), "chat-app-make-")));
	fixtures.push(root);
	const write = (path, contents) => {
		mkdirSync(join(root, path, ".."), { recursive: true });
		writeFileSync(join(root, path), contents);
	};
	copyFileSync(new URL("Makefile", source), join(root, "Makefile"));
	write(".env.example", validEnv);
	write(".env", "MAKEFILE_FIXTURE_VALUE=wrong-default\n");
	write("selected env", validEnv);
	write("scripts/bin/docker", '#!/bin/sh\nprintf "%s\\n" "$@" >> "$MAKE_CALLS"\n');
	write("scripts/bin/curl", '#!/bin/sh\nprintf "%s\\n" "$@" >> "$MAKE_CALLS"\n');
	spawnSync("chmod", ["+x", join(root, "scripts/bin/docker"), join(root, "scripts/bin/curl")]);
	const env = { ...process.env, ENV_FILE: "selected env", MAKE_CALLS: join(root, "calls") };
	return {
		env,
		make: (...args) => spawnSync("make", ["--no-print-directory", ...args], { cwd: root, encoding: "utf8", env }),
		root,
		write,
	};
};
afterEach(() => {
	for (const root of fixtures.splice(0)) rmSync(root, { force: true, recursive: true });
});

test("setup and validation use the selected environment file without replacing the default", () => {
	const f = fixture();
	const result = f.make("setup", "ENV_FILE=new env");
	expect(result.status).toBe(0);
	expect(readFileSync(join(f.root, "new env"), "utf8")).toBe(validEnv);
	expect(readFileSync(join(f.root, ".env"), "utf8")).toContain("wrong-default");
	expect(f.make("validate", "ENV_FILE=new env").status).toBe(0);
});

test("Compose commands receive the selected environment path as one argument", () => {
	const f = fixture();
	expect(f.make("stop").status).toBe(0);
	expect(readFileSync(join(f.root, "calls"), "utf8").trim().split("\n")).toEqual([
		"compose",
		"--env-file",
		"selected env",
		"down",
	]);
});

test("health uses the selected hostname and API slug", () => {
	const f = fixture();
	expect(f.make("health").status).toBe(0);
	const calls = readFileSync(join(f.root, "calls"), "utf8");
	expect(calls).toContain("https://custom.localhost/health\n");
	expect(calls).toContain("https://custom.localhost/v1/ready\n");
});

test("Kubernetes values use the same image references as the Make build targets", () => {
	const f = fixture();
	f.write("package.json", JSON.stringify({ scripts: { "k8s:prepare": "bash scripts/ensure-k8s-secrets.sh" } }));
	f.write("helm/chat-app/.fixture", "");
	copyFileSync(new URL("scripts/ensure-k8s-secrets.sh", source), join(f.root, "scripts/ensure-k8s-secrets.sh"));
	const result = f.make(
		"k8s-setup",
		"K8S_CLIENT_IMAGE=chat-client:preview",
		"K8S_SERVER_IMAGE=localhost:5000/preview/chat-server:preview",
		"K8S_MIGRATE_IMAGE=preview/chat-migrate",
	);
	expect(result.stderr).not.toContain("Invalid local image tag");
	expect(result.status).toBe(0);
	const { images } = Bun.YAML.parse(readFileSync(join(f.root, "helm/chat-app/values.local.yaml"), "utf8"));
	for (const [component, repository, tag] of [
		["client", "chat-client", "preview"],
		["server", "localhost:5000/preview/chat-server", "preview"],
		["migrate", "preview/chat-migrate", "latest"],
	]) {
		expect(images[component]).toEqual({ digest: "", pullPolicy: "Never", registry: "", repository, tag });
	}
});

test("Kubernetes migration applies and waits for the same Job with a custom release", () => {
	const f = fixture();
	copyFileSync(new URL("scripts/run-k8s-migration.sh", source), join(f.root, "scripts/run-k8s-migration.sh"));
	f.write(
		"scripts/bin/helm",
		'#!/bin/sh\nprintf "apiVersion: batch/v1\\nkind: Job\\nmetadata:\\n  name: preview-chat-app-migration\\n"\n',
	);
	f.write(
		"scripts/bin/kubectl",
		'#!/bin/sh\nprintf "%s\\n" "$*" >> "$MAKE_CALLS"\nif [ "$1" = apply ]; then cat > "$MAKE_CALLS.job"; fi\n',
	);
	spawnSync("chmod", ["+x", join(f.root, "scripts/bin/helm"), join(f.root, "scripts/bin/kubectl")]);
	for (const name of ["preview-chat-app-migration", "manual-migration"]) {
		const result = f.make(
			"k8s-migrate",
			"K8S_RELEASE=preview",
			"K8S_NAMESPACE=test",
			`K8S_MIGRATE_JOB=${name === "manual-migration" ? name : ""}`,
		);
		expect(result.status).toBe(0);
		expect(JSON.parse(readFileSync(join(f.root, "calls.job"), "utf8")).metadata.name).toBe(name);
		const calls = readFileSync(join(f.root, "calls"), "utf8");
		expect(calls).toContain(`delete job ${name} -n test --ignore-not-found\n`);
		expect(calls).toContain(`wait --for=condition=complete job/${name} -n test --timeout=300s\n`);
	}
});

test("generated cleanup preserves dependencies, tracked routes, environment and local tooling", () => {
	const f = fixture();
	for (const file of [
		"node_modules/keep.tsbuildinfo",
		"client/node_modules/keep",
		"client/src/routeTree.gen.ts",
		".local/bin/keep.tsbuildinfo",
		"client/dist/remove",
		"client/cache.tsbuildinfo",
		"test-results/remove",
		"playwright-report/remove",
	])
		f.write(file, "fixture");
	expect(f.make("clean-generated").status).toBe(0);
	for (const file of [
		"node_modules/keep.tsbuildinfo",
		"client/node_modules/keep",
		"client/src/routeTree.gen.ts",
		".local/bin/keep.tsbuildinfo",
		".env",
	])
		expect(existsSync(join(f.root, file))).toBe(true);
	for (const file of ["client/dist", "client/cache.tsbuildinfo", "test-results", "playwright-report"])
		expect(existsSync(join(f.root, file))).toBe(false);
});

const alive = (pid) => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};
const until = async (condition) => {
	for (let attempt = 0; attempt < 100; attempt++) {
		if (condition()) return;
		await Bun.sleep(25);
	}
	throw new Error("Fixture did not reach expected state");
};
const lifecycle = () => {
	const f = fixture();
	const helper = join(f.root, "scripts/local-dev.mjs");
	copyFileSync(new URL("scripts/local-dev.mjs", source), helper);
	f.write("scripts/bin/ps", '#!/bin/sh\nprintf "fixture-start bun %s start\\n" "$LOCAL_DEV_HELPER"\n');
	spawnSync("chmod", ["+x", join(f.root, "scripts/bin/ps")]);
	for (const workspace of ["server", "client"]) {
		f.write(`${workspace}/package.json`, JSON.stringify({ scripts: { dev: "bun dev.mjs" } }));
		f.write(
			`${workspace}/dev.mjs`,
			`import { appendFileSync } from 'node:fs'; import {spawn} from 'node:child_process'; const child=spawn(process.execPath,['--no-env-file','-e','setInterval(()=>{},1000)'],{stdio:'ignore'}); appendFileSync('../children.jsonl',JSON.stringify({pid:process.pid,child:child.pid,value:process.env.MAKEFILE_FIXTURE_VALUE})+'\\n');setInterval(()=>{},1000);`,
		);
	}
	const env = { ...f.env, LOCAL_DEV_HELPER: helper, PATH: `${join(f.root, "scripts/bin")}:${process.env.PATH}` };
	return {
		...f,
		env,
		helper,
		start: () => spawn(process.execPath, ["--no-env-file", helper, "start"], { cwd: f.root, env, stdio: "ignore" }),
		stop: () => spawnSync(process.execPath, ["--no-env-file", helper, "stop"], { cwd: f.root, encoding: "utf8", env }),
	};
};

test("local stop refuses a reused PID from an unrelated process", () => {
	const f = lifecycle();
	const unrelated = spawn("sleep", ["30"]);
	try {
		f.write(
			".local/dev.pids",
			JSON.stringify({ identity: "old process identity", pid: unrelated.pid, root: `${f.root}/`, token: "old" }),
		);
		expect(f.stop().status).toBe(0);
		expect(alive(unrelated.pid)).toBe(true);
	} finally {
		unrelated.kill();
	}
});

test("local startup recovers a legacy PID file, rejects concurrent starts, and stops descendants", async () => {
	const f = lifecycle();
	f.write(".local/dev.pids", "12345\n67890\n");
	const first = f.start();
	const second = f.start();
	const exited = Promise.all(
		[first, second].map((child) => new Promise((resolveExit) => child.once("exit", resolveExit))),
	);
	try {
		await until(
			() =>
				existsSync(join(f.root, "children.jsonl")) &&
				readFileSync(join(f.root, "children.jsonl"), "utf8").trim().split("\n").length === 2,
		);
		const children = readFileSync(join(f.root, "children.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
		expect(children.map((child) => child.value)).toEqual(["selected", "selected"]);
		await until(() => [first, second].some((child) => child.exitCode !== null));
		expect([first, second].filter((child) => child.exitCode !== null).map((child) => child.exitCode)).toEqual([1]);
		expect(f.stop().status).toBe(0);
		await exited;
		await until(() => children.every((child) => !alive(child.pid) && !alive(child.child)));
		expect(existsSync(join(f.root, ".local/dev.pids"))).toBe(false);
		expect(existsSync(join(f.root, ".local/dev.pids.lock"))).toBe(false);
	} finally {
		first.kill();
		second.kill();
		await exited;
	}
}, 10000);
