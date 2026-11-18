import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"]
    }
  },
  build: {
    target: "esnext",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html")
      }
    }
  }
});
