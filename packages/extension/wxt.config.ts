import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  // WXT and @tailwindcss/vite resolve different bundled vite versions, so their
  // config types conflict. The values are correct at runtime; annotate the return
  // as `any` to bypass the cross-version type mismatch.
  // biome-ignore lint/suspicious/noExplicitAny: cross-version vite config type mismatch
  vite: (): any => ({
    plugins: tailwindcss(),
    build: {
      minify: "esbuild",
    },
  }),
  manifest: {
    name: "openpicker",
    description: "Open-source CSS element picker.",
    permissions: ["storage", "activeTab", "scripting"],
    action: {},
  },
})
