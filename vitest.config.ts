import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "tests/fixtures/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["tests/**", "dist/**", "**/*.config.ts"],
    },
  },
});
