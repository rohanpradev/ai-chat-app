import { readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const readSource = (path) => readFileSync(new URL(path, root), "utf8");

// Validate the actual install, build, and test entrypoints before expensive checks.
// No private .env files or generated local deployment overrides are read here.
export const checkToolchain = ({ read = readSource, runtime = Bun.version } = {}) => {
	const manifest = JSON.parse(read("package.json"));
	const version = /^bun@(\d+\.\d+\.\d+)$/.exec(manifest.packageManager)?.[1];
	if (!version) throw new Error("package.json must pin a stable Bun packageManager release.");
	const equal = (actual, expected, label) => {
		if (actual !== expected) throw new Error(`${label} must be ${expected}; received ${actual ?? "missing"}.`);
	};
	const assignment = (source, name) => new RegExp(`^${name}=(.+)$`, "m").exec(source)?.[1];
	const argument = (source, name) => assignment(source, `ARG ${name}`)?.replaceAll(`\${BUN_VERSION}`, version);
	const composeDefault = (value, name) => {
		const prefix = `\${${name}:-`;
		return typeof value === "string" && value.startsWith(prefix) && value.endsWith("}")
			? value.slice(prefix.length, -1)
			: undefined;
	};

	equal(runtime, version, "Running Bun release");
	equal(manifest.engines?.bun, `>=${version}`, "Root Bun engine floor");
	const server = JSON.parse(read("server/package.json"));
	equal(server.engines?.bun, `>=${version}`, "Server Bun engine floor");
	const lock = Bun.JSON5.parse(read("bun.lock"));
	for (const name of ["@types/bun", "bun-types"]) {
		equal(server.devDependencies?.[name], version, `${name} release`);
		equal(lock.workspaces?.server?.devDependencies?.[name], version, `Locked server ${name} requirement`);
		equal(lock.packages?.[name]?.[0], `${name}@${version}`, `Locked ${name} package`);
		for (const [key, entry] of Object.entries(lock.packages ?? {})) {
			if (key.endsWith(`/${name}`)) {
				equal(entry?.[0], `${name}@${version}`, `Locked ${name} package (${key})`);
			}
		}
	}

	const ci = Bun.YAML.parse(read(".github/workflows/ci.yml"));
	const sonar = Bun.YAML.parse(read(".github/workflows/sonar.yml"));
	equal(ci.env?.BUN_VERSION, version, "CI Bun release");
	equal(sonar.env?.BUN_VERSION, version, "Sonar Bun release");
	const image = ci.env?.BUN_IMAGE;
	if (!new RegExp(`^oven/bun:${version.replaceAll(".", "\\.")}-alpine@sha256:[a-f0-9]{64}$`).test(image ?? "")) {
		throw new Error("CI BUN_IMAGE must pin the selected Bun release and immutable multi-platform digest.");
	}
	const nginx = ci.env?.NGINX_IMAGE;
	if (!/^nginx:[^@\s]+@sha256:[a-f0-9]{64}$/.test(nginx ?? "")) {
		throw new Error("CI NGINX_IMAGE must pin a release and immutable multi-platform digest.");
	}
	for (const path of ["Dockerfile", "server/Dockerfile.migrate"]) {
		const source = read(path);
		equal(argument(source, "BUN_VERSION"), version, `${path} Bun release`);
		equal(argument(source, "BUN_DEV_IMAGE"), image, `${path} Bun build image`);
		if (path === "Dockerfile") {
			equal(argument(source, "BUN_RUNTIME_IMAGE"), image, `${path} Bun runtime image`);
			equal(argument(source, "NGINX_IMAGE"), nginx, `${path} Nginx image`);
		}
	}
	const compose = Bun.YAML.parse(read("compose.yml"));
	for (const [name, expected] of [
		["BUN_DEV_IMAGE", image],
		["BUN_RUNTIME_IMAGE", image],
		["NGINX_IMAGE", nginx],
	]) {
		equal(composeDefault(compose["x-bun-build-args"]?.[name], name), expected, `Compose ${name} default`);
		equal(assignment(read(".env.example"), name), expected, `.env.example ${name}`);
	}
	const nodeVersion = read(".nvmrc").trim();
	if (!Bun.semver.satisfies(nodeVersion, manifest.engines?.node ?? "")) {
		throw new Error(`.nvmrc Node ${nodeVersion} does not satisfy the declared tooling engine.`);
	}
	return { bun: version, node: nodeVersion };
};

if (import.meta.main) {
	const versions = checkToolchain();
	console.log(`Toolchain pins match: Bun ${versions.bun}, Node ${versions.node}, immutable Bun/Nginx build images.`);
}
