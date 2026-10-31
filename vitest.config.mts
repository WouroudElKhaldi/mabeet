import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = {
  "@": path.resolve(import.meta.dirname, "src"),
  "@tests": path.resolve(import.meta.dirname, "tests"),
};

// A module keeps its tests next to its code (src/modules/<name>/tests). Tests that need the database end in
// .integration.test.ts; the rest are unit tests. Tests of the shared kernel stay in tests/.

export default defineConfig({
  resolve: { alias },
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts", "src/modules/*/tests/**/*.test.ts"],
          exclude: ["**/*.integration.test.ts", "**/node_modules/**"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          include: ["tests/integration/**/*.test.ts", "src/modules/*/tests/**/*.integration.test.ts"],
          environment: "node",
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup-env.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
