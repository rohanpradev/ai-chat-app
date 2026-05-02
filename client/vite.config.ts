import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const maxIntentionalChunkWarningKb = 1500;

const browserNodeShims = {
  diagnostics_channel: resolve(
    __dirname,
    "./src/lib/browser-node-shims/diagnostics-channel.ts",
  ),
  "node:diagnostics_channel": resolve(
    __dirname,
    "./src/lib/browser-node-shims/diagnostics-channel.ts",
  ),
};

const vendorChunkGroups = [
  { name: "react-vendor", test: /\/react(?:-dom)?\//, priority: 50 },
  { name: "router-vendor", test: /@tanstack/, priority: 45 },
  { name: "ai-vendor", test: /@ai-sdk|ai\//, priority: 40 },
  {
    name: "ui-vendor",
    test: /@radix-ui|lucide-react|class-variance-authority/,
    priority: 35,
  },
  {
    name: "stream-core-vendor",
    test: /\/streamdown\//,
    priority: 34,
  },
  {
    name: "stream-plugin-vendor",
    test: /@streamdown|ansi-to-react/,
    priority: 33,
  },
  {
    name: "syntax-vendor",
    // Keep the Shiki runtime together, but leave language/theme loaders as
    // independent async chunks so rendered code blocks only fetch what they use.
    test: /@shikijs\/(?:core|engine-javascript|primitive|types|vscode-textmate)|highlight\.js|react-syntax-highlighter/,
    priority: 32,
  },
  {
    name: "diagram-d3-vendor",
    test: /\/(?:d3|d3-[^/]+)\//,
    priority: 31,
  },
  {
    name: "diagram-cytoscape-vendor",
    test: /cytoscape/,
    priority: 30,
  },
  {
    name: "diagram-layout-vendor",
    test: /dagre|elkjs|katex|khroma|roughjs|stylis|@upsetjs/,
    priority: 29,
  },
  {
    name: "mermaid-vendor",
    test: /mermaid|@mermaid-js/,
    priority: 28,
  },
  {
    name: "flow-vendor",
    test: /@xyflow/,
    priority: 27,
  },
  {
    name: "media-vendor",
    test: /media-chrome|@rive-app/,
    priority: 26,
  },
  {
    name: "markdown-vendor",
    test: /react-markdown|rehype|remark|mdast|hast|micromark|unified/,
    priority: 25,
  },
  { name: "vendor", test: /node_modules/, priority: 1 },
];

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
        ...browserNodeShims,
        "@": resolve(__dirname, "./src"),
        "@shared": resolve(__dirname, "../shared"),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: vendorChunkGroups,
          },
        },
      },
      target: "esnext",
      minify: "oxc",
      chunkSizeWarningLimit: maxIntentionalChunkWarningKb,
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
