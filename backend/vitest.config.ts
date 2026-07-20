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
        statements: 66,
        branches: 55,
        functions: 66,
        lines: 66,
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
        },
        "src/services/session-store.ts": {
          statements: 80,
          branches: 80,
          functions: 80,
          lines: 80
        },
        "src/services/google-oauth.ts": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        "src/services/discord-oauth.ts": {
          statements: 100,
          branches: 90,
          functions: 100,
          lines: 100
        },
        "src/services/twitch-oauth.ts": {
          statements: 100,
          branches: 85,
          functions: 100,
          lines: 100
        },
        "src/services/auth.ts": {
          statements: 100,
          branches: 85,
          functions: 100,
          lines: 100
        },
        "src/routes/contributions.ts": {
          statements: 85,
          branches: 70,
          functions: 100,
          lines: 85
        }
      }
    }
  }
});
