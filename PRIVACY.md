# OpenPicker — Privacy Policy

_Last updated: 2026-06-03_

OpenPicker is an open-source browser extension that lets you point at an element on a web page
and get a stable CSS selector for it. This policy explains what the extension does and does not do
with your data.

## The short version

**OpenPicker does not collect, transmit, or sell your data. There are no OpenPicker servers.**
Everything happens locally in your browser. We have no analytics, no tracking, and no ads.

## What is stored, and where

The extension stores a small amount of configuration **locally in your browser** (via the browser's
extension storage). It is never sent anywhere:

- **Selector settings** per website (which of id / class / attributes a selector may use, and your
  ignore/allow patterns).
- **Authorization mode** (allow all / ask / blocklist) and the **per-site allow/block decisions**
  you make.

You can review or clear these at any time from the extension's options page.

## What happens during a pick

- The **selector and basic element details** produced by a pick are delivered to the web page that
  started the pick (or shown to you when you pick from the toolbar). This stays within your browser;
  OpenPicker does not send it to us or any third party.
- A **screenshot** is captured only when a pick explicitly requests one. It is returned to the
  requesting page / shown in the picker, again only within your browser. OpenPicker does not upload
  it anywhere.

## Permissions

- **Host access to all sites (`<all_urls>`)** — you can start a pick on any website you choose, so
  the extension needs to draw the picker overlay (and optionally capture a screenshot) on the page
  you're picking on. The set of sites isn't known in advance.
- **`tabs`** — to open a target URL in a new tab, route the resulting selector back to the tab that
  started the pick, and return focus.
- **`activeTab`** — to act on the current tab when you start a pick from the toolbar.
- **`storage`** — to save the local settings described above.

The extension never injects third-party code and never runs remote code.

## Changes

If this policy changes, the updated version will be published in this repository with a new date.

## Contact

Questions or concerns: open an issue at
<https://github.com/usertour/openpicker/issues>, or visit <https://www.usertour.io>.
