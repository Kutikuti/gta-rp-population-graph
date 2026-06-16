import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["dist/**", "node_modules/**"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      reporter: ["text", "html"]
    }
  }
});
