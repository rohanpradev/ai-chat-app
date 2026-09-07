import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const distAssetsDir = new URL("../client/dist/assets/", import.meta.url);
const assetDirectoryPath = fileURLToPath(distAssetsDir);

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;
const totalJavaScriptBudgetBytes = Number(process.env.BUNDLE_MAX_TOTAL_JS_KIB ?? 16 * 1024) * 1024;
const singleJavaScriptBudgetBytes = Number(process.env.BUNDLE_MAX_SINGLE_JS_KIB ?? 1536) * 1024;
const initialJavaScriptBudgetBytes = Number(process.env.BUNDLE_MAX_INITIAL_JS_KIB ?? 800) * 1024;

// Follow static imports only: optional renderers and route chunks should not
// count toward the JavaScript needed to start the app.
const manifest = JSON.parse(readFileSync(new URL("../client/dist/.vite/manifest.json", import.meta.url), "utf8"));
const initialFiles = new Set();
const visitedChunks = new Set();
const visitChunk = (key) => {
	if (visitedChunks.has(key)) return;
	visitedChunks.add(key);
	const chunk = manifest[key];
	if (!chunk) throw new Error(`Missing bundle manifest entry: ${key}`);
	if (chunk.file.endsWith(".js")) initialFiles.add(chunk.file);
	for (const dependency of chunk.imports ?? []) visitChunk(dependency);
};
const entries = Object.keys(manifest).filter((key) => manifest[key].isEntry);
if (entries.length === 0) throw new Error("Bundle manifest has no entry points");
for (const entry of entries) visitChunk(entry);
const initialJavaScriptBytes = [...initialFiles].reduce(
	(sum, file) => sum + statSync(new URL(`../client/dist/${file}`, import.meta.url)).size,
	0,
);

const rows = readdirSync(assetDirectoryPath)
	.filter((entry) => entry.endsWith(".js") || entry.endsWith(".css"))
	.map((entry) => {
		const absolutePath = join(assetDirectoryPath, entry);
		const buffer = readFileSync(absolutePath);

		return {
			file: entry,
			gzipBytes: gzipSync(buffer).byteLength,
			rawBytes: statSync(absolutePath).size,
			type: entry.endsWith(".css") ? "css" : "js",
		};
	})
	.sort((left, right) => right.rawBytes - left.rawBytes);

const topAssets = rows.slice(0, 12);
const totalJavaScriptBytes = rows.filter((row) => row.type === "js").reduce((sum, row) => sum + row.rawBytes, 0);
const totalCssBytes = rows.filter((row) => row.type === "css").reduce((sum, row) => sum + row.rawBytes, 0);

console.log("Client bundle summary");
console.log(`Initial JS: ${formatKiB(initialJavaScriptBytes)} (budget ${formatKiB(initialJavaScriptBudgetBytes)})`);
console.log(`Total JS:  ${formatKiB(totalJavaScriptBytes)}`);
console.log(`Total CSS: ${formatKiB(totalCssBytes)}`);
console.log("Largest emitted assets:");

for (const asset of topAssets) {
	console.log(
		`${asset.file.padEnd(40)} ${asset.type.toUpperCase().padEnd(3)} raw ${formatKiB(asset.rawBytes).padStart(10)} gzip ${formatKiB(asset.gzipBytes).padStart(10)}`,
	);
}

const oversizedAsset = rows.find((row) => row.type === "js" && row.rawBytes > singleJavaScriptBudgetBytes);
if (
	initialJavaScriptBytes > initialJavaScriptBudgetBytes ||
	totalJavaScriptBytes > totalJavaScriptBudgetBytes ||
	oversizedAsset
) {
	console.error("Client bundle budget exceeded.");
	if (initialJavaScriptBytes > initialJavaScriptBudgetBytes) {
		console.error(`Initial JS must stay below ${formatKiB(initialJavaScriptBudgetBytes)}.`);
	}
	if (totalJavaScriptBytes > totalJavaScriptBudgetBytes) {
		console.error(`Total JS must stay below ${formatKiB(totalJavaScriptBudgetBytes)}.`);
	}
	if (oversizedAsset) {
		console.error(`${oversizedAsset.file} must stay below ${formatKiB(singleJavaScriptBudgetBytes)}.`);
	}
	process.exit(1);
}
