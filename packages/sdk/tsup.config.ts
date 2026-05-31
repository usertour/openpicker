import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  treeshake: true,
  // @openpicker/protocol is a private, source-only package: bundle it into the output.
  noExternal: [/@openpicker\/protocol/],
})
