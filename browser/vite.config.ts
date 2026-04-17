import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
import path from "node:path";

export default defineConfig({
  plugins: [solid(), tailwindcss(), wasm(), topLevelAwait()],
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "../src"),
      "@tauri-apps/api/core": path.resolve(__dirname, "./src/shims/tauri-core.ts"),
      "@tauri-apps/api/event": path.resolve(__dirname, "./src/shims/tauri-event.ts"),
      "@tauri-apps/plugin-os": path.resolve(__dirname, "./src/shims/tauri-os.ts"),
      "@tauri-apps/plugin-notification": path.resolve(__dirname, "./src/shims/tauri-notification.ts"),
      "@tauri-apps/plugin-dialog": path.resolve(__dirname, "./src/shims/tauri-dialog.ts"),
      "@tauri-apps/plugin-barcode-scanner": path.resolve(__dirname, "./src/shims/tauri-barcode.ts"),
      "@tauri-apps/plugin-clipboard-manager": path.resolve(__dirname, "./src/shims/tauri-clipboard.ts"),
      "@tauri-apps/plugin-opener": path.resolve(__dirname, "./src/shims/tauri-opener.ts"),
      "@tauri-apps/plugin-shell": path.resolve(__dirname, "./src/shims/tauri-shell.ts"),
      "@tauri-apps/plugin-fs": path.resolve(__dirname, "./src/shims/tauri-fs.ts"),
      "@tauri-apps/plugin-http": path.resolve(__dirname, "./src/shims/tauri-http.ts"),
    },
  },
  base: "./",
  optimizeDeps: {
    exclude: ["solid-markdown-wasm"],
  },
  server: {
    fs: {
      allow: [".."],
    },
  },
});
