import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const stateFile = resolve(root, process.env.LOCAL_PID_FILE ?? ".local/dev.pids");
const pause = (milliseconds) => new Promise((resolvePause) => setTimeout(resolvePause, milliseconds));
const identity = (pid) => {
	const result = spawnSync("ps", ["-p", String(pid), "-o", "lstart=,args="], { encoding: "utf8" });
	return result.status === 0 ? result.stdout.trim() : undefined;
};
const readState = async () => {
	try {
		return JSON.parse(await readFile(stateFile, "utf8"));
	} catch (error) {
		if (error.code === "ENOENT" || error instanceof SyntaxError) return undefined;
		throw error;
	}
};
const isOwner = (state) =>
	state?.root === root &&
	Number.isSafeInteger(state.pid) &&
	state.pid > 1 &&
	typeof state.identity === "string" &&
	state.identity.includes(fileURLToPath(import.meta.url)) &&
	identity(state.pid) === state.identity;

if (process.argv[2] === "stop") {
	const state = await readState();
	if (!isOwner(state)) {
		console.log("No verified project development supervisor is running; no processes were signalled.");
		process.exit(0);
	}
	process.kill(state.pid, "SIGTERM");
	for (let attempt = 0; attempt < 100 && (await readState())?.token === state.token; attempt++) await pause(50);
	if ((await readState())?.token === state.token) throw new Error("Development services did not finish stopping.");
	console.log("Local development services stopped.");
} else if (process.argv[2] === "start") {
	await mkdir(dirname(stateFile), { recursive: true });
	const lock = `${stateFile}.lock`;
	try {
		await mkdir(lock);
	} catch (error) {
		if (error.code !== "EEXIST") throw error;
		if (isOwner(await readState()) || Date.now() - (await stat(lock)).mtimeMs < 5000) {
			throw new Error("Development services are running or starting; use make local-stop first.");
		}
		await rm(lock, { recursive: true });
		await mkdir(lock);
	}
	try {
		const previous = await readState();
		if (isOwner(previous)) throw new Error("Development services are already running; use make local-stop first.");
		const supervisorIdentity = identity(process.pid);
		if (!supervisorIdentity) throw new Error("Cannot verify development supervisor identity; no services started.");
		const state = { identity: supervisorIdentity, pid: process.pid, root, token: randomUUID() };
		const staged = resolve(lock, "state.json");
		await writeFile(staged, JSON.stringify(state), { flag: "wx", mode: 0o600 });
		await rename(staged, stateFile);
		const children = ["server", "client"].map((workspace) =>
			spawn(
				process.execPath,
				["run", "--no-orphans", "--env-file", resolve(root, process.env.ENV_FILE ?? ".env"), "dev"],
				{
					cwd: resolve(root, workspace),
					stdio: "inherit",
				},
			),
		);
		const exits = children.map(
			(child) =>
				new Promise((resolveExit) => {
					child.once("error", () => resolveExit(1));
					child.once("exit", (code, signal) => resolveExit(signal ? 1 : (code ?? 1)));
				}),
		);
		let onSignal;
		const interrupted = new Promise((resolveSignal) => {
			onSignal = () => resolveSignal(0);
			for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.once(signal, onSignal);
		});
		try {
			process.exitCode = await Promise.race([...exits, interrupted]);
		} finally {
			for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.removeListener(signal, onSignal);
			for (const child of children) {
				try {
					child.kill("SIGTERM");
				} catch (error) {
					if (error.code !== "ESRCH") {
						console.error("Could not stop development process tree:", error.code);
						process.exitCode = 1;
					}
				}
			}
			await Promise.race([Promise.all(exits), pause(2000)]);
			for (const child of children) {
				try {
					child.kill("SIGKILL");
				} catch (error) {
					if (error.code !== "ESRCH") {
						console.error("Could not stop development process tree:", error.code);
						process.exitCode = 1;
					}
				}
			}
			if ((await readState())?.token === state.token) await rm(stateFile);
		}
	} finally {
		await rm(lock, { force: true, recursive: true });
	}
} else {
	throw new Error("Usage: bun scripts/local-dev.mjs <start|stop>");
}
