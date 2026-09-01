import { sentryBunPlugin } from "@sentry/bun/plugin";

type ServerPackage = {
	dependencies?: Record<string, string>;
};

const serverRoot = new URL("../", import.meta.url);
const sourceRoot = new URL("../src/", import.meta.url);
const packageJson = (await Bun.file(new URL("package.json", serverRoot)).json()) as ServerPackage;

const result = await Bun.build({
	entrypoints: [
		new URL("index.ts", sourceRoot).pathname,
		new URL("instrumentation.ts", sourceRoot).pathname,
	],
	external: Object.keys(packageJson.dependencies ?? {}),
	outdir: new URL("dist/", serverRoot).pathname,
	plugins: [sentryBunPlugin()],
	root: sourceRoot.pathname,
	target: "bun",
});

if (!result.success) {
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}
