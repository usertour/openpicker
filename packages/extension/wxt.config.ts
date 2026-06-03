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
    permissions: ["storage", "activeTab", "scripting", "tabs"],
    // captureVisibleTab needs host access (or an activeTab gesture). Cross-tab and
    // SDK-triggered picks have no per-tab gesture, so grant host access for the
    // screenshot capability to work on any page.
    host_permissions: ["<all_urls>"],
    // The toolbar action's popup is wired automatically from entrypoints/popup; we
    // only add the toolbar-button icon here (WXT sets manifest.icons from
    // public/icon/* but not action.default_icon). This deep-merges with the
    // generated action, keeping default_popup intact.
    // (The options page opens as a full tab — see the meta tag in options/index.html.)
    action: {
      default_icon: {
        "16": "icon/16.png",
        "32": "icon/32.png",
        "48": "icon/48.png",
        "128": "icon/128.png",
      },
    },
  },
})
