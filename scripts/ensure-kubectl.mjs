import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { constants } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const version = readFileSync(join(root, ".kubectl-version"), "utf8").trim();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** Fetch once, verify before every execution, and keep the host installation untouched. */
export async function ensureKubectl(options = {}) {
	if (!/^v1\.\d+\.\d+$/.test(version))
		throw new Error(".kubectl-version must contain a pinned Kubernetes v1.x.y release.");
	const platform = { darwin: "darwin", linux: "linux", win32: "windows" }[process.platform];
	const architecture = { arm64: "arm64", x64: "amd64" }[process.arch];
	if (!platform || !architecture)
		throw new Error(`Managed kubectl does not support ${process.platform}/${process.arch}.`);
	const binaryName = platform === "windows" ? "kubectl.exe" : "kubectl";
	const directory = options.cacheDirectory ?? join(root, ".local", "bin", `${version}-${platform}-${architecture}`);
	const executable = join(directory, binaryName);
	const checksumFile = `${executable}.sha256`;
	if (existsSync(executable) && existsSync(checksumFile)) {
		const expected = readFileSync(checksumFile, "utf8").trim();
		if (/^[a-f0-9]{64}$/.test(expected) && sha256(readFileSync(executable)) === expected) return executable;
	}

	const url = `https://dl.k8s.io/release/${version}/bin/${platform}/${architecture}/${binaryName}`;
	const download = options.fetch ?? fetch;
	const [binaryResponse, checksumResponse] = await Promise.all([
		download(url, { signal: AbortSignal.timeout(60_000) }),
		download(`${url}.sha256`, { signal: AbortSignal.timeout(60_000) }),
	]).catch(() => {
		throw new Error(`Unable to download official kubectl ${version}; check access to https://dl.k8s.io and retry.`);
	});
	if (!binaryResponse.ok || !checksumResponse.ok) {
		throw new Error(`Unable to download official kubectl ${version}; check access to https://dl.k8s.io and retry.`);
	}
	const [bytes, checksumText] = await Promise.all([binaryResponse.arrayBuffer(), checksumResponse.text()]);
	const expected = checksumText.trim();
	if (!/^[a-f0-9]{64}$/.test(expected) || sha256(new Uint8Array(bytes)) !== expected) {
		throw new Error(`Official kubectl ${version} checksum verification failed; no downloaded binary was installed.`);
	}

	mkdirSync(directory, { recursive: true });
	const temporaryBinary = join(directory, `.kubectl-${randomUUID()}`);
	const temporaryChecksum = `${temporaryBinary}.sha256`;
	try {
		writeFileSync(temporaryBinary, new Uint8Array(bytes), { flag: "wx", mode: 0o755 });
		writeFileSync(temporaryChecksum, expected, { flag: "wx", mode: 0o644 });
		renameSync(temporaryBinary, executable);
		renameSync(temporaryChecksum, checksumFile);
	} finally {
		rmSync(temporaryBinary, { force: true });
		rmSync(temporaryChecksum, { force: true });
	}
	return executable;
}

if (import.meta.main) {
	try {
		const executable = await ensureKubectl();
		const child = spawn(executable, process.argv.slice(2), { stdio: "inherit" });
		const signals = ["SIGINT", "SIGTERM"];
		const handlers = signals.map((signal) => {
			const handler = () => child.kill(signal);
			process.on(signal, handler);
			return [signal, handler];
		});
		try {
			const result = await new Promise((resolve, reject) => {
				child.once("error", reject);
				child.once("close", (code, signal) => resolve({ code, signal }));
			});
			process.exitCode = result.code ?? (result.signal ? 128 + constants.signals[result.signal] : 1);
		} finally {
			for (const [signal, handler] of handlers) process.off(signal, handler);
		}
	} catch (error) {
		console.error(`Managed kubectl: ${error instanceof Error ? error.message : "setup failed"}`);
		process.exitCode = 1;
	}
}
