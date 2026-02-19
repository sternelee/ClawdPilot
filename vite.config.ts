import path from "path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    wasm(), // Add this plugin (must be before solid())
    solid(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    host: true, // 允许从网络访问，包括 localhost 和系统 IP
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Ensure proper base path for Tauri
  base: "./",
  optimizeDeps: {
    exclude: ["solid-markdown-wasm"],
  },
});
