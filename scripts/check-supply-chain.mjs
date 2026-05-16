import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const lockText = readFileSync(join(repoRoot, "bun.lock"), "utf8");

const affectedPackageVersions = new Map([
	["@mistralai/mistralai", ["2.2.2", "2.2.3", "2.2.4"]],
	["@mistralai/mistralai-azure", ["1.7.1", "1.7.2", "1.7.3"]],
	["@mistralai/mistralai-gcp", ["1.7.1", "1.7.2", "1.7.3"]],
	["@tanstack/history", ["1.161.9", "1.161.12"]],
	["@tanstack/react-router", ["1.169.5", "1.169.8"]],
	["@tanstack/react-router-devtools", ["1.166.16", "1.166.19"]],
	["@tanstack/router-core", ["1.169.5", "1.169.8"]],
	["@tanstack/router-devtools-core", ["1.167.6", "1.167.9"]],
	["@tanstack/router-generator", ["1.166.45", "1.166.48"]],
	["@tanstack/router-plugin", ["1.167.38", "1.167.41"]],
	["@tanstack/router-utils", ["1.161.11", "1.161.14"]],
	["@tanstack/virtual-file-routes", ["1.161.10", "1.161.13"]],
	["@tanstack/zod-adapter", ["1.166.12", "1.166.15"]],
	["@uipath/apollo-core", ["5.9.2"]],
	["@uipath/apollo-react", ["4.24.5"]],
	["@uipath/apollo-wind", ["2.16.2"]],
	["@uipath/cli", ["1.0.1"]],
	["@uipath/filesystem", ["1.0.1"]],
	["@uipath/rpa-tool", ["0.9.5"]],
]);

const suspiciousFilenames = new Set([
	"bun_environment.js",
	"setup_bun.js",
	"truffleSecrets.json",
	"shai-hulud-workflow.yml",
	"shai-hulud-workflow.yaml",
]);

const ignoredDirs = new Set([".git", ".next", ".turbo", "coverage", "dist", "node_modules", "out", "out-order"]);

const findings = [];

for (const [packageName, versions] of affectedPackageVersions) {
	for (const version of versions) {
		if (lockText.includes(`"${packageName}": ["${packageName}@${version}"`)) {
			findings.push(`Compromised package version in bun.lock: ${packageName}@${version}`);
		}
	}
}

const walk = (dir) => {
	for (const entry of readdirSync(dir)) {
		if (ignoredDirs.has(entry)) {
			continue;
		}

		const path = join(dir, entry);
		const stats = statSync(path);

		if (stats.isDirectory()) {
			walk(path);
			continue;
		}

		if (suspiciousFilenames.has(basename(path))) {
			findings.push(`Suspicious supply-chain artifact: ${relative(repoRoot, path)}`);
		}
	}
};

walk(repoRoot);

if (findings.length > 0) {
	console.error("Supply-chain check failed:");
	for (const finding of findings) {
		console.error(`- ${finding}`);
	}
	process.exit(1);
}

console.log("Supply-chain check passed: no known Shai-Hulud indicators found.");
