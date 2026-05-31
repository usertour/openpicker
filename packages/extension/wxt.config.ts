import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    // WXT and @tailwindcss/vite resolve different bundled vite versions, so the
    // Plugin types differ at the type level (they are compatible at runtime).
    // Cast to sidestep the mismatch without pinning vite or importing its types.
    // biome-ignore lint/suspicious/noExplicitAny: cross-version vite Plugin type mismatch
    plugins: tailwindcss() as any,
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
