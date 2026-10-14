import { defineConfig } from "vite";
import { resolve } from "path";

// https://vite.dev/config/
export default defineConfig({
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
        main: resolve(import.meta.dirname, "index.html"),
        free: resolve(import.meta.dirname, "free.html")
      }
    }
  }
});
