---
layout: home
hero:
  name: openpicker
  text: Pick an element, get its selector.
  tagline: An open-source CSS element picker for the web — a browser extension plus a tiny SDK. Point at any element on any page and get a stable CSS selector back.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: SDK reference
      link: /developers/sdk
    - theme: alt
      text: Live demo
      link: https://demo.openpicker.dev
features:
  - title: Stable selectors
    details: Built on a proven selector engine, with filters that skip auto-generated ids and hashed CSS-in-JS / CSS-module class names.
  - title: Tunable per site
    details: Choose whether selectors use id / class / attributes, set ignore patterns and an attribute allow-list — remembered per website.
  - title: Inspector built in
    details: An editable selector with a live match count, a DOM-tree navigator, and the element's attributes — in an overlay that never clashes with the page.
  - title: Cross-tab picking
    details: An app can open a URL, let the user pick there, and get the selector routed back — the one thing a page can't do for itself.
  - title: Private by design
    details: No servers, no tracking, no data leaves your browser. You choose which sites may use the picker.
  - title: Light / Dark / System
    details: The picker, popup, and options follow your theme — set it once, applied everywhere.
---
