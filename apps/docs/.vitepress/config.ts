import { defineConfig } from "vitepress"

const GITHUB = "https://github.com/usertour/openpicker"

export default defineConfig({
  title: "OpenPicker",
  description:
    "Documentation for OpenPicker — an open-source CSS element picker for the web (browser extension + SDK).",
  cleanUrls: true,
  lastUpdated: true,
  srcExclude: ["**/README.md"],
  // Emit a sitemap so Google indexes the canonical (clean) URLs directly instead of
  // discovering URL variants and consolidating them. Submit it in Search Console.
  sitemap: {
    hostname: "https://docs.openpicker.dev",
  },
  // Self-referential canonical per page. With cleanUrls, duplicate variants Google may
  // crawl (…/page.html → 307 → /page, the production *.workers.dev origin, etc.) all
  // point back to the clean URL, so they consolidate here rather than competing.
  transformPageData(pageData) {
    const canonical = `https://docs.openpicker.dev/${pageData.relativePath}`
      .replace(/index\.md$/, "")
      .replace(/\.md$/, "")
    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(["link", { rel: "canonical", href: canonical }])
  },
  head: [
    ["link", { rel: "icon", href: "/openpicker.svg" }],
    ["meta", { name: "theme-color", content: "#0f172a" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "OpenPicker docs" }],
    [
      "meta",
      {
        property: "og:description",
        content:
          "Docs for OpenPicker — an open-source CSS element picker (browser extension + SDK).",
      },
    ],
    ["meta", { property: "og:image", content: "https://docs.openpicker.dev/og.png" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:image", content: "https://docs.openpicker.dev/og.png" }],
  ],
  themeConfig: {
    logo: "/openpicker.svg",
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Developers", link: "/developers/sdk" },
      { text: "Live demo", link: "https://demo.openpicker.dev" },
      { text: "openpicker.dev", link: "https://openpicker.dev" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Guide",
          items: [
            { text: "Getting started", link: "/guide/getting-started" },
            { text: "Using the picker", link: "/guide/using-the-picker" },
            { text: "Configuring selectors", link: "/guide/configuring-selectors" },
            { text: "Authorization", link: "/guide/authorization" },
            { text: "Appearance", link: "/guide/appearance" },
          ],
        },
      ],
      "/developers/": [
        {
          text: "Developers",
          items: [
            { text: "SDK", link: "/developers/sdk" },
            { text: "Cross-tab picking", link: "/developers/cross-tab" },
            { text: "Protocol", link: "/developers/protocol" },
            { text: "Errors", link: "/developers/errors" },
          ],
        },
      ],
    },
    socialLinks: [{ icon: "github", link: GITHUB }],
    search: { provider: "local" },
    editLink: {
      pattern: `${GITHUB}/edit/main/apps/docs/:path`,
      text: "Edit this page on GitHub",
    },
    footer: {
      message: "Released under the MIT License.",
      copyright: "Maintained by Usertour",
    },
  },
})
