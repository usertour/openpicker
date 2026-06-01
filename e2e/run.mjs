// End-to-end test for the openpicker extension, driven over the Chrome DevTools
// Protocol with zero dependencies (Node 22+ provides global fetch and WebSocket).
//
// It loads the built extension into headless Chrome and exercises the full pick
// flow against a fixture page: ping -> pick -> consent Allow -> hover an element
// -> click to lock -> OK -> assert a PickResult with the expected selector.
//
// Usage:
//   node e2e/run.mjs [path-to-unpacked-extension]
// Defaults to packages/extension/.output/chrome-mv3. Override Chrome with
// OPENPICKER_CHROME=/path/to/chrome.

import { spawn } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import http from "node:http"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const EXT = resolve(process.argv[2] ?? join(HERE, "..", "packages/extension/.output/chrome-mv3"))
const CHROME =
  process.env.OPENPICKER_CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const PORT = 7410
const DEBUG_PORT = 9330
const fixture = readFileSync(join(HERE, "fixture.html"), "utf8")

const log = (...a) => console.log(...a)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "text/html" })
  res.end(fixture)
})
await new Promise((r) => server.listen(PORT, r))

const userDir = mkdtempSync(join(tmpdir(), "openpicker-e2e-"))
const chrome = spawn(CHROME, [
  "--headless=new",
  `--user-data-dir=${userDir}`,
  `--remote-debugging-port=${DEBUG_PORT}`,
  "--no-first-run",
  "--no-default-browser-check",
  `--disable-extensions-except=${EXT}`,
  `--load-extension=${EXT}`,
  `http://localhost:${PORT}/`,
])
chrome.stderr.on("data", () => {})

let nextId = 0
const call = (ws, method, params) =>
  new Promise((resolve) => {
    const id = ++nextId
    const onMsg = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id === id) {
        ws.removeEventListener("message", onMsg)
        resolve(m.result)
      }
    }
    ws.addEventListener("message", onMsg)
    ws.send(JSON.stringify({ id, method, params }))
  })
const evalExpr = async (ws, expression) =>
  (await call(ws, "Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }))
    ?.result?.value

const dispatchAt = (elId, type, ctor) =>
  `(()=>{const el=document.getElementById('${elId}');const r=el.getBoundingClientRect();` +
  `el.dispatchEvent(new ${ctor}('${type}',{bubbles:true,button:0,clientX:r.left+5,clientY:r.top+5}));return true})()`

const clickShadowButton = (match) =>
  `(()=>{const sr=document.querySelector('openpicker-ui').shadowRoot;` +
  `const b=[...sr.querySelectorAll('button')].find(x=>${match});if(b){b.click();return true}return false})()`

let exitCode = 1
let cdp
try {
  let pageWs
  for (let i = 0; i < 40 && !pageWs; i++) {
    await sleep(500)
    try {
      const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json()
      pageWs = list.find((t) => t.type === "page" && t.url.includes(`localhost:${PORT}`))
        ?.webSocketDebuggerUrl
    } catch {}
  }
  if (!pageWs) throw new Error("no page target")

  cdp = new WebSocket(pageWs)
  await new Promise((res, rej) => {
    cdp.addEventListener("open", res, { once: true })
    cdp.addEventListener("error", rej, { once: true })
  })
  await call(cdp, "Runtime.enable", {})
  await call(cdp, "Page.enable", {})

  // The startup tab can load before the extension registers its content script;
  // reload once it's ready so the content script injects.
  await sleep(1500)
  await call(cdp, "Page.reload", {})
  await sleep(2500)

  // 1. ping
  await evalExpr(cdp, "window.__opPing()")
  let pong = null
  for (let i = 0; i < 20 && !pong; i++) {
    pong = await evalExpr(cdp, "window.__op.pong")
    await sleep(300)
  }
  const pingOk = !!pong && pong.capabilities?.includes("pick")
  log("ping:", pingOk ? "ok" : "FAILED", JSON.stringify(pong))

  // 2. pick -> consent prompt
  await evalExpr(cdp, "window.__opPick()")
  let shadow = null
  for (let i = 0; i < 25; i++) {
    await sleep(400)
    shadow = await evalExpr(cdp, "window.__opShadow()")
    if (shadow?.host) break
  }
  const consentOk = !!shadow?.host && /Allow element picking/.test(shadow.text || "")
  log("consent prompt:", consentOk ? "ok" : "FAILED", JSON.stringify(shadow))

  // 3. Allow -> hover -> lock -> OK
  await evalExpr(cdp, clickShadowButton("/Allow/.test(x.textContent)"))
  await sleep(1000)
  await evalExpr(cdp, dispatchAt("cta", "mousemove", "MouseEvent"))
  await sleep(500)
  await evalExpr(cdp, dispatchAt("cta", "pointerdown", "PointerEvent"))
  await sleep(1000)

  const selectorVal = await evalExpr(
    cdp,
    "(()=>{const sr=document.querySelector('openpicker-ui').shadowRoot;const i=sr.querySelector('input[type=text]');return i?i.value:null})()",
  )
  log("locked selector:", JSON.stringify(selectorVal))

  await evalExpr(cdp, clickShadowButton("x.textContent.trim()==='OK'"))
  await sleep(1000)

  // 4. assert the PickResult reached the page
  const result = JSON.parse((await evalExpr(cdp, "JSON.stringify(window.__op.lastRes||null)")) || "null")
  log("PickResult:", JSON.stringify(result))

  const pickOk =
    typeof selectorVal === "string" &&
    selectorVal.length > 0 &&
    result?.ok === true &&
    !!result?.result?.selector &&
    result?.result?.element?.tag === "button"

  const allOk = pingOk && consentOk && pickOk
  log("")
  log(allOk ? "PASS" : "FAIL")
  exitCode = allOk ? 0 : 1
} catch (e) {
  log("ERROR:", e.message)
} finally {
  try {
    cdp?.close()
  } catch {}
  chrome.kill("SIGKILL")
  server.close()
  rmSync(userDir, { recursive: true, force: true })
}
process.exit(exitCode)
