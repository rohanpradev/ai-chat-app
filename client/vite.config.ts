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
	const isProduction = mode === "production";
	
	return {
		plugins: [
			tanstackRouter({ 
				target: "react", 
				autoCodeSplitting: true,
			}), 
			viteReact({
				// Use Oxc's React refresh transform for better performance
				babel: undefined // Disable Babel to use Oxc
			}), 
			tailwindcss()
		],
		resolve: {
			alias: {
				"@": resolve(__dirname, "./src"),
			},
		},
		// Optimize build with Rolldown's advanced features
		build: {
			rollupOptions: {
				output: {
					// Use Rolldown's advanced chunking (preferred over manualChunks)
					advancedChunks: {
						groups: [
							{ name: 'react-vendor', test: /\/react(?:-dom)?\// },
							{ name: 'router-vendor', test: /@tanstack/ },
							{ name: 'ai-vendor', test: /@ai-sdk|ai\// },
							{ name: 'ui-vendor', test: /@radix-ui|lucide-react|class-variance-authority/ },
							{ name: 'markdown-vendor', test: /react-markdown|rehype|remark|katex/ },
							{ name: 'vendor', test: /node_modules/ }
						]
					}
				}
			},
			chunkSizeWarningLimit: 1000,
			target: 'esnext',
			// Enable Rolldown's native minification
			minify: 'oxc',
		},
		// Rolldown-optimized dependency handling
		optimizeDeps: {
			include: [
				'react',
				'react-dom',
				'@tanstack/react-query',
				'@tanstack/react-router',
				'@ai-sdk/react',
			],
			exclude: ['@tanstack/react-router-devtools'],
		},
		// Enable Rolldown's native plugins for better performance
		experimental: {
			enableNativePlugin: 'v1'
		},
		server: {
			host: "0.0.0.0",
			port: 5173,
			hmr: {
				overlay: !isProduction,
			},
			watch: {
				ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**']
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
