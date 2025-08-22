import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), "");
	return {
		plugins: [tanstackRouter({ target: "react", autoCodeSplitting: true }), viteReact(), tailwindcss()],
		resolve: {
			alias: {
				"@": resolve(__dirname, "./src"),
			},
		},
		server: {
			host: "0.0.0.0",
			port: 5173,
			watch: {
				ignored: ['**/node_modules/**', '**/.git/**']
			},
			proxy: {
				'/api': {
					target: `http://localhost:${env.SERVER_PORT || 3000}`,
					changeOrigin: true,
					secure: false,
				},
			},
		},
	};
});
