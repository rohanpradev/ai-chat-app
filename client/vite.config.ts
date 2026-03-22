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
      viteReact(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": resolve(__dirname, "./src"),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: "react-vendor", test: /\/react(?:-dom)?\// },
              { name: "router-vendor", test: /@tanstack/ },
              { name: "ai-vendor", test: /@ai-sdk|ai\// },
              {
                name: "ui-vendor",
                test: /@radix-ui|lucide-react|class-variance-authority/,
              },
              {
                name: "stream-core-vendor",
                test: /\/streamdown\//,
              },
              {
                name: "stream-plugin-vendor",
                test: /@streamdown|ansi-to-react/,
              },
              {
                name: "syntax-vendor",
                test: /shiki|highlight\.js|react-syntax-highlighter/,
              },
              {
                name: "mermaid-vendor",
                test: /mermaid/,
              },
              {
                name: "diagram-d3-vendor",
                test: /\/d3-[^/]+\//,
              },
              {
                name: "diagram-cytoscape-vendor",
                test: /cytoscape/,
              },
              {
                name: "diagram-layout-vendor",
                test: /dagre|katex/,
              },
              {
                name: "flow-vendor",
                test: /@xyflow/,
              },
              {
                name: "media-vendor",
                test: /media-chrome|@rive-app/,
              },
              {
                name: "markdown-vendor",
                test: /react-markdown|rehype|remark|mdast|hast|micromark|unified/,
              },
              { name: "vendor", test: /node_modules/ },
            ],
          },
        },
      },
      // Mermaid and its layout engines are loaded on demand for fenced diagrams,
      // so allow a higher warning threshold for that isolated lazy chunk.
      chunkSizeWarningLimit: 2000,
      target: "esnext",
      minify: "oxc",
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "@tanstack/react-query",
        "@tanstack/react-router",
        "@ai-sdk/react",
      ],
      exclude: ["@tanstack/react-router-devtools"],
    },
    server: {
      host: "0.0.0.0",
      port: 5173,
      hmr: {
        overlay: !isProduction,
      },
      watch: {
        ignored: ["**/node_modules/**", "**/.git/**", "**/dist/**"],
      },
      proxy: {
        "/api": {
          target: `http://localhost:${env.SERVER_PORT || 3000}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
});
