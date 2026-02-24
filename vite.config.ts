import path from "path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import { fixCjsModules } from "./plugins/fix-cjs-modules";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    wasm(),
    solid(),
    tailwindcss(),
    fixCjsModules(), // Fix CJS modules that cause issues
  ],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./src"),
    },
  },
  clearScreen: false,
  server: {
    host: true,
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  base: "./",
  optimizeDeps: {
    exclude: ["solid-markdown-wasm"],
  },
});
