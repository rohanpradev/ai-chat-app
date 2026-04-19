import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const distAssetsDir = new URL("../client/dist/assets/", import.meta.url);
const assetDirectoryPath = fileURLToPath(distAssetsDir);

const formatKiB = (bytes) => `${(bytes / 1024).toFixed(2)} KiB`;

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
console.log(`Total JS:  ${formatKiB(totalJavaScriptBytes)}`);
console.log(`Total CSS: ${formatKiB(totalCssBytes)}`);
console.log("Largest emitted assets:");

for (const asset of topAssets) {
	console.log(
		`${asset.file.padEnd(40)} ${asset.type.toUpperCase().padEnd(3)} raw ${formatKiB(asset.rawBytes).padStart(10)} gzip ${formatKiB(asset.gzipBytes).padStart(10)}`,
	);
}
