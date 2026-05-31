import tailwindcss from "@tailwindcss/vite"
import type { PluginOption } from "vite"
import { defineConfig } from "wxt"

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ["@wxt-dev/module-react"],
  vite: () => ({
    // @tailwindcss/vite types its plugins against a different bundled vite than
    // WXT's; the shapes are compatible at runtime, so align them with a cast.
    plugins: tailwindcss() as PluginOption[],
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
