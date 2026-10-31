import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { checkToolchain } from "./check-toolchain.mjs";

const root = new URL("..", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const pinned = JSON.parse(read("package.json")).packageManager.replace("bun@", "");
const altered = (file, transform) => (path) => (path === file ? transform(read(path)) : read(path));
const alteredLock = (transform) =>
	altered("bun.lock", (source) => {
		const lock = Bun.JSON5.parse(source);
		transform(lock);
		return JSON.stringify(lock);
	});

test("install, runtime, CI, and container entrypoints agree without reading private environment files", () => {
	const visited = [];
	expect(
		checkToolchain({
			read: (path) => {
				visited.push(path);
				return read(path);
			},
			runtime: pinned,
		}).bun,
	).toBe(pinned);
	expect(visited).not.toContain(".env");
});

test("an old local Bun cannot provide false-green upgrade checks", () => {
	expect(() => checkToolchain({ runtime: "0.0.1" })).toThrow("Running Bun release");
});

test("Bun type packages cannot drift ahead of the deployed runtime", () => {
	expect(() =>
		checkToolchain({
			read: altered("server/package.json", (source) => {
				const manifest = JSON.parse(source);
				manifest.devDependencies["bun-types"] = "^99.0.0";
				return JSON.stringify(manifest);
			}),
			runtime: pinned,
		}),
	).toThrow("bun-types release");
});

test.each([
	["@types/bun", "^"],
	["@types/bun", "~"],
	["bun-types", "^"],
	["bun-types", "~"],
])("%s cannot use a %s range that admits newer runtime APIs", (name, prefix) => {
	expect(() =>
		checkToolchain({
			read: altered("server/package.json", (source) => {
				const manifest = JSON.parse(source);
				manifest.devDependencies[name] = `${prefix}${pinned}`;
				return JSON.stringify(manifest);
			}),
			runtime: pinned,
		}),
	).toThrow(`${name} release`);
});

test.each(["@types/bun", "bun-types"])("the lockfile must pin the server's %s requirement", (name) => {
	expect(() =>
		checkToolchain({
			read: alteredLock((lock) => {
				lock.workspaces.server.devDependencies[name] = `^${pinned}`;
			}),
			runtime: pinned,
		}),
	).toThrow(`Locked server ${name} requirement`);
});

test.each(["@types/bun", "bun-types"])("resolved %s must match the deployed runtime", (name) => {
	expect(() =>
		checkToolchain({
			read: alteredLock((lock) => {
				lock.packages[name][0] = `${name}@99.0.0`;
			}),
			runtime: pinned,
		}),
	).toThrow(`Locked ${name} package`);
});

test.each(["@types/bun", "bun-types"])("nested copies of %s cannot introduce newer runtime APIs", (name) => {
	expect(() =>
		checkToolchain({
			read: alteredLock((lock) => {
				lock.packages[`another-package/${name}`] = [`${name}@99.0.0`, "", {}, "sha512-test"];
			}),
			runtime: pinned,
		}),
	).toThrow(`Locked ${name} package`);
});

test.each(["Dockerfile", "server/Dockerfile.migrate", "compose.yml", ".env.example"])(
	"a mutable Bun image in %s is rejected before a build",
	(file) => {
		expect(() =>
			checkToolchain({
				read: altered(file, (source) => source.replace(/(@sha256:[a-f0-9]{64})/, "")),
				runtime: pinned,
			}),
		).toThrow(/Bun build image|Compose BUN_DEV_IMAGE|\.env\.example BUN_DEV_IMAGE/);
	},
);

test("Sonar cannot silently install a different runtime", () => {
	expect(() =>
		checkToolchain({
			read: altered(".github/workflows/sonar.yml", (source) =>
				source.replace(`BUN_VERSION: ${pinned}`, "BUN_VERSION: 0.0.1"),
			),
			runtime: pinned,
		}),
	).toThrow("Sonar Bun release");
});

test("an unsupported Node tooling release is rejected", () => {
	expect(() => checkToolchain({ read: altered(".nvmrc", () => "20.0.0"), runtime: pinned })).toThrow("tooling engine");
});
