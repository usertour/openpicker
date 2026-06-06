import { defineConfig } from "tsup"

// protocol is private and source-first for internal bundlers (the extension and the
// SDK's runtime bundle it from src). This build exists so the SDK's *published types*
// can resolve a single self-contained declaration file: tsup/rollup-plugin-dts inlines
// protocol's own relative modules (./methods, ./selectorTokens, …) into one index.d.ts,
// which the SDK then inlines in turn (see packages/sdk/tsconfig.json `paths`). JS is
// emitted too so that path also resolves at runtime.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
})
