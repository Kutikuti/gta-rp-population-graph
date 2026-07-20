import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:4000",
      "/uploads": "http://localhost:4000"
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    coverage: {
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/test/**", "src/**/*.test.{ts,tsx}"],
      reporter: ["text", "json-summary", "html"],
      thresholds: {
        statements: 78,
        branches: 65,
        functions: 72,
        lines: 78,
        "src/components/CharacterPhotoUpload.tsx": {
          statements: 93,
          branches: 85,
          functions: 94,
          lines: 93
        },
        "src/components/GraphPreferencesPanel.tsx": {
          statements: 75,
          branches: 75,
          functions: 70,
          lines: 75
        },
        "src/components/ModerationView.tsx": {
          statements: 80,
          branches: 70,
          functions: 75,
          lines: 80
        },
        "src/components/ModerationRequestList.tsx": {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100
        },
        "src/components/CharacterSnapshotForm.tsx": {
          statements: 80,
          branches: 70,
          functions: 75,
          lines: 80
        },
        "src/components/AdminTagsPanel.tsx": {
          statements: 100,
          branches: 90,
          functions: 100,
          lines: 100
        },
        "src/graph/useCytoscapeGraph.ts": {
          statements: 100,
          branches: 90,
          functions: 100,
          lines: 100
        }
      }
    }
  }
});
