import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    fileParallelism: false,
    hookTimeout: 30_000,
    include: ["src/integration/**/*.integration.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 30_000
  }
});
