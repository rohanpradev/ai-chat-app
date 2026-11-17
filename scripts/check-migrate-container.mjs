import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

const image = process.argv[2] ?? "chat-app-migrate:latest";
const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const server = JSON.parse(readFileSync(new URL("../server/package.json", import.meta.url), "utf8"));
const result = spawnSync(
	"docker",
	[
		"run",
		"--rm",
		"--network=none",
		"--read-only",
		"--cap-drop=ALL",
		"--security-opt=no-new-privileges:true",
		"--tmpfs=/tmp:size=64m,mode=1777",
		"--env=DB_URL=postgres://postgres:postgres@127.0.0.1:5432/chatapp",
		`--env=EXPECTED_BUN_VERSION=${manifest.packageManager.slice(4)}`,
		`--env=EXPECTED_ORM_VERSION=${server.dependencies["drizzle-orm"]}`,
		`--env=EXPECTED_KIT_VERSION=${server.devDependencies["drizzle-kit"]}`,
		image,
		"bun",
		"-e",
		`import assert from "node:assert/strict";
		assert.notEqual(process.getuid(), 0, "Migration must run as non-root");
		assert.equal(Bun.version, process.env.EXPECTED_BUN_VERSION);
		for (const [name, expected] of [
			["drizzle-orm", process.env.EXPECTED_ORM_VERSION],
			["drizzle-kit", process.env.EXPECTED_KIT_VERSION],
		]) {
			assert.equal((await Bun.file("node_modules/" + name + "/package.json").json()).version, expected);
		}
		for (const command of ["db:check", "db:generate"]) {
			const checked = Bun.spawnSync(["bun", "run", command]);
			const output = new TextDecoder().decode(checked.stdout) + new TextDecoder().decode(checked.stderr);
			assert.equal(checked.exitCode, 0, command + " failed: " + output);
			assert.doesNotMatch(output, /warning|schema was not compared/i, command + " skipped validation: " + output);
			assert.match(output, command === "db:check" ? /Everything's fine/ : /No schema changes/, output);
			console.log(command + ": schema and incremental snapshots verified");
		}`,
	],
	{ encoding: "utf8", timeout: 60_000 },
);
if (result.error) throw result.error;
assert.equal(result.status, 0, `Migration container check failed:\n${result.stdout}\n${result.stderr}`);
process.stdout.write(result.stdout);
console.log("Migration entrypoint and toolchain passed (non-root, read-only, no network).");
