import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // resolve: inline @openpicker/protocol's types into the .d.ts. protocol is
  // private/unpublished, so a bare re-export would break consumers' types. tsconfig
  // `paths` points protocol at its built single-file dist (see tsconfig.json), so this
  // resolves and inlines cleanly into one self-contained declaration file.
  dts: { resolve: [/@openpicker\/protocol/] },
  clean: true,
  treeshake: true,
  // @openpicker/protocol is a private, source-only package: bundle it into the output.
  noExternal: [/@openpicker\/protocol/],
})
