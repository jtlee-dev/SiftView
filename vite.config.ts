import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// When building for GitHub Pages, set BASE to your repo name, e.g. base: "/SiftView/"
const base = process.env.GITHUB_PAGES === "1" ? "/SiftView/" : "/";

export default defineConfig({
  base,
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.js"],
  },
});
