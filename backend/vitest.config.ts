import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    exclude: ["dist/**", "node_modules/**", "src/integration/**"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      include: ["src/**/*.ts"],
      exclude: ["src/test/**", "src/**/*.test.ts"],
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        statements: 60,
        branches: 47,
        functions: 60,
        lines: 60,
        "src/services/change-request-mutations.ts": {
          statements: 95,
          branches: 90,
          functions: 100,
          lines: 95
        },
        "src/services/change-requests.ts": {
          statements: 85,
          branches: 65,
          functions: 90,
          lines: 85
        }
      }
    }
  }
});
