import { defineConfig } from "vitest/config"

/**
 * Unit tests run from the repo root across all workspace packages. The default
 * environment is Node; DOM-dependent suites opt in per file with a
 * `// @vitest-environment jsdom` docblock (see the picker tests). `@openpicker/protocol`
 * is a source-only package (its exports point at src), so it resolves with no alias.
 */
export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.output/**", "**/.wxt/**", "**/dist/**"],
    setupFiles: ["./tests/setup.ts"],
  },
})
