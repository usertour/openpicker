import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  // @openpicker/protocol is a published dependency: keep it external (the default) so
  // the SDK's .d.ts re-exports its types from the real package and npm dedupes the
  // runtime — no bundling.
  external: ["@openpicker/protocol"],
})
