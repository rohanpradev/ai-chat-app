import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = fileURLToPath(new URL("../server/", import.meta.url));
const migrationRoot = fileURLToPath(new URL("../server/src/db/drizzle/", import.meta.url));
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

const snapshotDirectory = (root) => {
	const files = [];
	const visit = (directory) => {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			const path = join(directory, entry.name);

			if (entry.isDirectory()) {
				visit(path);
				continue;
			}

			files.push([relative(root, path), createHash("sha256").update(readFileSync(path)).digest("hex")]);
		}
	};

	visit(root);
	return files.sort(([left], [right]) => left.localeCompare(right));
};

run("bun", ["run", "db:check"], serverRoot);
const beforeGenerate = snapshotDirectory(migrationRoot);
run("bun", ["run", "db:generate"], serverRoot);
const afterGenerate = snapshotDirectory(migrationRoot);

if (JSON.stringify(beforeGenerate) !== JSON.stringify(afterGenerate)) {
	throw new Error("drizzle-kit generate changed the migration directory; commit the generated output");
}

console.log("Drizzle migration history and generated output are consistent.");
