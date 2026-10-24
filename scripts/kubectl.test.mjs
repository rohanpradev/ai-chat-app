import { afterEach, expect, test } from "bun:test";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureKubectl } from "./ensure-kubectl.mjs";

const directories = [];
afterEach(() => {
	for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});

const temporaryDirectory = () => {
	const directory = mkdtempSync(join(tmpdir(), "chat-app-kubectl-test-"));
	directories.push(directory);
	return directory;
};
const pinnedVersion = readFileSync(new URL("../.kubectl-version", import.meta.url), "utf8").trim();
const pinnedMinor = Number(pinnedVersion.split(".")[1]);
const versionResult = (clientMinor, serverMinor = 36) => ({
	clientVersion: {
		gitVersion: clientMinor === pinnedMinor ? pinnedVersion : `v1.${clientMinor}.1`,
		major: "1",
		minor: String(clientMinor),
	},
	serverVersion: { gitVersion: `v1.${serverMinor}.5`, major: "1", minor: String(serverMinor) },
});
const fixtureBinary = `#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(versionResult(pinnedMinor))}'\n`;
const checksum = createHash("sha256").update(fixtureBinary).digest("hex");
const downloaded = [];
const successfulDownload = async (url) => {
	downloaded.push(String(url));
	return new Response(String(url).endsWith(".sha256") ? checksum : fixtureBinary);
};

test("a pinned verified client passes the preflight that rejects an old host client", async () => {
	const check = (versions) =>
		spawnSync(process.execPath, ["scripts/check-k8s-versions.mjs"], {
			cwd: new URL("..", import.meta.url),
			encoding: "utf8",
			input: JSON.stringify(versions),
		});
	const baseline = check(versionResult(33));
	expect(baseline.status).toBe(1);
	expect(baseline.stderr).toContain("incompatible");
	const executable = await ensureKubectl({ cacheDirectory: temporaryDirectory(), fetch: successfulDownload });
	const managed = spawnSync(executable, ["version", "-o", "json"], { encoding: "utf8" });
	expect(managed.status).toBe(0);
	const versions = JSON.parse(managed.stdout);
	expect(versions.clientVersion.gitVersion).toBe(pinnedVersion);
	for (const serverMinor of [35, 36, 37]) {
		expect(check({ ...versions, serverVersion: versionResult(pinnedMinor, serverMinor).serverVersion }).status).toBe(0);
	}
});

test("the verified cache works offline without downloading or using the host binary", async () => {
	const cacheDirectory = temporaryDirectory();
	const executable = await ensureKubectl({ cacheDirectory, fetch: successfulDownload });
	const cached = await ensureKubectl({
		cacheDirectory,
		fetch: async () => {
			throw new Error("offline");
		},
	});
	expect(cached).toBe(executable);
	expect(readFileSync(cached, "utf8")).toBe(fixtureBinary);
});

test("a mismatched publisher checksum never creates an executable", async () => {
	const cacheDirectory = temporaryDirectory();
	await expect(
		ensureKubectl({
			cacheDirectory,
			fetch: async (url) => new Response(String(url).endsWith(".sha256") ? "0".repeat(64) : fixtureBinary),
		}),
	).rejects.toThrow("checksum");
	expect(existsSync(join(cacheDirectory, "kubectl"))).toBe(false);
});

test("a changed cached binary is never executed or accepted while offline", async () => {
	const cacheDirectory = temporaryDirectory();
	const executable = await ensureKubectl({ cacheDirectory, fetch: successfulDownload });
	writeFileSync(executable, "#!/bin/sh\nexit 99\n");
	await expect(
		ensureKubectl({
			cacheDirectory,
			fetch: async () => {
				throw new Error("offline");
			},
		}),
	).rejects.toThrow();
});

test("download URLs use the shared CI pin and official release origin", async () => {
	downloaded.length = 0;
	await ensureKubectl({ cacheDirectory: temporaryDirectory(), fetch: successfulDownload });
	const pin = readFileSync(new URL("../.kubectl-version", import.meta.url), "utf8").trim();
	expect(downloaded).toHaveLength(2);
	for (const url of downloaded) expect(url).toStartWith(`https://dl.k8s.io/release/${pin}/bin/`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
	test(`${signal} reaches a long-lived child and closes the launcher pipes`, async () => {
		const directory = temporaryDirectory();
		mkdirSync(join(directory, "scripts/bin"), { recursive: true });
		for (const file of [".kubectl-version", "scripts/bin/kubectl", "scripts/ensure-kubectl.mjs"]) {
			copyFileSync(new URL(`../${file}`, import.meta.url), join(directory, file));
		}
		writeFileSync(join(directory, ".env"), "CHAT_APP_KUBECTL_UNEXPECTED_ENV=loaded\n");
		const binary = `#!${process.execPath} --no-env-file\nif (process.env.CHAT_APP_KUBECTL_UNEXPECTED_ENV) process.exit(92);\nprocess.stdout.write(String(process.pid) + "\\n");\nprocess.on("${signal}", () => { process.stdout.write("child-terminated\\n"); process.exit(73); });\nsetInterval(() => {}, 1000);\n`;
		const digest = createHash("sha256").update(binary).digest("hex");
		const platform = process.platform === "win32" ? "windows" : process.platform;
		const architecture = process.arch === "x64" ? "amd64" : process.arch;
		await ensureKubectl({
			cacheDirectory: join(directory, ".local/bin", `${pinnedVersion}-${platform}-${architecture}`),
			fetch: async (url) => new Response(String(url).endsWith(".sha256") ? digest : binary),
		});
		const launcher = spawn("bash", [join(directory, "scripts/bin/kubectl"), "port-forward"], {
			cwd: directory,
			stdio: ["ignore", "pipe", "pipe"],
		});
		let output = "";
		let childPid;
		const completion = new Promise((resolve, reject) => {
			launcher.once("error", reject);
			launcher.once("close", (code, signal) => resolve({ code, signal }));
		});
		try {
			await new Promise((resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error("child did not start")), 2000);
				launcher.stdout.on("data", (data) => {
					output += String(data);
					if (output.includes("\n")) {
						childPid = Number(output.split("\n")[0]);
						clearTimeout(timeout);
						resolve();
					}
				});
			});
			launcher.kill(signal);
			let timeout;
			const result = await Promise.race([
				completion,
				new Promise((_, reject) => {
					timeout = setTimeout(() => reject(new Error("launcher pipes remained open after termination")), 2000);
				}),
			]).finally(() => clearTimeout(timeout));
			expect(result).toEqual({ code: 73, signal: null });
			expect(output).toContain("child-terminated");
			expect(() => process.kill(childPid, 0)).toThrow();
		} finally {
			launcher.kill("SIGKILL");
			if (childPid) {
				try {
					process.kill(childPid, "SIGKILL");
				} catch {
					/* The successful path already reaped the child. */
				}
			}
			await completion;
		}
	});
}

for (const [entrypoint, prepareScript] of [
	["deploy-k8s.sh", "ensure-k8s-secrets.sh"],
	["deploy-k8s-traefik.sh", "ensure-k8s-traefik-values.sh"],
]) {
	test(`${entrypoint} passes preflight with an old host client before any mutation`, async () => {
		const directory = temporaryDirectory();
		for (const subdirectory of ["scripts/bin", "host-bin"]) mkdirSync(join(directory, subdirectory), { recursive: true });
		for (const file of [
			".kubectl-version",
			`scripts/${entrypoint}`,
			"scripts/bin/kubectl",
			"scripts/ensure-kubectl.mjs",
			"scripts/check-k8s-versions.mjs",
		]) {
			copyFileSync(new URL(`../${file}`, import.meta.url), join(directory, file));
		}
		writeFileSync(
			join(directory, "host-bin/kubectl"),
			`#!/bin/sh\nprintf '%s\\n' '${JSON.stringify(versionResult(33))}'\n`,
			{ mode: 0o755 },
		);
		writeFileSync(
			join(directory, `scripts/${prepareScript}`),
			"#!/bin/sh\necho reached-reviewed-mutation-boundary >&2\nexit 88\n",
		);
		const pin = readFileSync(join(directory, ".kubectl-version"), "utf8").trim();
		const platform = process.platform === "win32" ? "windows" : process.platform;
		const architecture = process.arch === "x64" ? "amd64" : process.arch;
		await ensureKubectl({
			cacheDirectory: join(directory, ".local/bin", `${pin}-${platform}-${architecture}`),
			fetch: successfulDownload,
		});
		const result = spawnSync("bash", [join(directory, `scripts/${entrypoint}`)], {
			encoding: "utf8",
			env: { ...process.env, PATH: `${join(directory, "host-bin")}:${process.env.PATH}` },
		});
		expect(result.status).toBe(88);
		expect(result.stdout).toContain("Kubernetes versions are compatible");
		expect(result.stderr).toContain("reached-reviewed-mutation-boundary");
	});
}
