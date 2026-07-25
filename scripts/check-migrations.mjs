import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const serverRoot = fileURLToPath(new URL("../server/", import.meta.url));
const dbUrl = process.env.DB_URL ?? process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/chatapp";

const run = (command, args, cwd) => {
	const result = spawnSync(command, args, {
		cwd,
		env: { ...process.env, DB_URL: dbUrl },
		stdio: "inherit",
	});

	if (result.error) {
		throw result.error;
	}

	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
	}
};

run("bun", ["run", "db:check"], serverRoot);
run("bun", ["run", "db:generate"], serverRoot);
run("git", ["diff", "--exit-code", "--", "server/src/db/drizzle"], repoRoot);

console.log("Drizzle migration history and generated output are consistent.");
