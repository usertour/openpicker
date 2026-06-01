// End-to-end test for the openpicker extension, driven over the Chrome DevTools
// Protocol with zero dependencies (Node 22+ provides global fetch and WebSocket).
//
// It loads the built extension into headless Chrome and exercises the full pick
// flow against a fixture page: ping -> pick -> consent Allow -> hover an element
// -> click to lock -> OK -> assert a PickResult with the expected selector.
//
// To guarantee the content script injects, we connect at the browser level, wait
// for the extension's service worker to register, and only then open the tab.
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
const PORT = 7461
const DEBUG_PORT = 9361
const FIXTURE_URL = `http://localhost:${PORT}/`
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
  "about:blank",
])
chrome.stderr.on("data", () => {})

// --- minimal flat-session CDP client over the browser-level WebSocket ----------
let nextId = 0
const pending = new Map()
let ws

function send(method, params = {}, sessionId) {
  return new Promise((resolve) => {
    const id = ++nextId
    pending.set(id, resolve)
    ws.send(JSON.stringify({ id, method, params, sessionId }))
  })
}
async function evalJson(sessionId, expression) {
  const wrapped = `JSON.stringify((()=>{try{return (${expression})}catch(e){return {__err:String(e)}}})())`
  const r = await send(
    "Runtime.evaluate",
    { expression: wrapped, returnByValue: true, awaitPromise: true },
    sessionId,
  )
  const raw = r?.result?.value
  return raw == null ? null : JSON.parse(raw)
}
const run = (sessionId, expression) =>
  send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId)

const dispatchAt = (elId, type, ctor) =>
  `(()=>{const el=document.getElementById('${elId}');const r=el.getBoundingClientRect();` +
  `el.dispatchEvent(new ${ctor}('${type}',{bubbles:true,button:0,clientX:r.left+5,clientY:r.top+5}));return true})()`

const clickShadowButton = (match) =>
  `(()=>{const sr=document.querySelector('openpicker-ui').shadowRoot;` +
  `const b=[...sr.querySelectorAll('button')].find(x=>${match});if(b){b.click();return true}return false})()`

let exitCode = 1
try {
  // 1. browser-level CDP endpoint
  let browserWsUrl
  for (let i = 0; i < 40 && !browserWsUrl; i++) {
    await sleep(500)
    try {
      browserWsUrl = (await (await fetch(`http://localhost:${DEBUG_PORT}/json/version`)).json())
        .webSocketDebuggerUrl
    } catch {}
  }
  if (!browserWsUrl) throw new Error("no browser CDP endpoint")

  ws = new WebSocket(browserWsUrl)
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true })
    ws.addEventListener("error", rej, { once: true })
  })
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const resolve = pending.get(m.id)
      pending.delete(m.id)
      resolve(m.result ?? m.error)
    }
  })

  // 2. wait for the extension's service worker to register
  let swReady = false
  for (let i = 0; i < 40 && !swReady; i++) {
    await sleep(500)
    try {
      const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json()
      swReady = list.some((t) => t.type === "service_worker" && t.url.startsWith("chrome-extension://"))
    } catch {}
  }
  log("extension service worker:", swReady ? "ready" : "NOT FOUND")

  // 3. open the fixture tab now that the content script is registered
  const created = await send("Target.createTarget", { url: FIXTURE_URL })
  const targetId = created?.targetId
  if (!targetId) throw new Error("Target.createTarget failed")
  const attached = await send("Target.attachToTarget", { targetId, flatten: true })
  const sessionId = attached?.sessionId
  if (!sessionId) throw new Error("attachToTarget failed")

  await send("Runtime.enable", {}, sessionId)
  await send("Page.enable", {}, sessionId)

  // wait for the content script to inject (it sets a data attribute)
  let injected = false
  for (let i = 0; i < 30 && !injected; i++) {
    await sleep(300)
    injected = (await evalJson(sessionId, "document.documentElement.dataset.openpicker || null")) === "loaded"
  }
  log("content script:", injected ? "injected" : "NOT injected")

  // 4. ping
  await run(sessionId, "window.__opPing()")
  let pong = null
  for (let i = 0; i < 20 && !pong; i++) {
    await sleep(300)
    pong = await evalJson(sessionId, "window.__op.pong")
  }
  const pingOk = !!pong && Array.isArray(pong.protocolVersions) && pong.capabilities?.includes("pick")
  log("ping:", pingOk ? "ok" : "FAILED", JSON.stringify(pong))

  // 5. pick -> consent prompt
  await run(sessionId, "window.__opPick()")
  let shadow = null
  for (let i = 0; i < 25; i++) {
    await sleep(400)
    shadow = await evalJson(sessionId, "window.__opShadow()")
    if (shadow?.host) break
  }
  const consentOk = !!shadow?.host && /Allow element picking/.test(shadow.text || "")
  log("consent prompt:", consentOk ? "ok" : "FAILED", JSON.stringify(shadow))

  // 6. Allow -> hover -> lock -> OK
  await run(sessionId, clickShadowButton("/Allow/.test(x.textContent)"))
  await sleep(1000)
  await run(sessionId, dispatchAt("cta", "mousemove", "MouseEvent"))
  await sleep(500)
  await run(sessionId, dispatchAt("cta", "pointerdown", "PointerEvent"))
  await sleep(1200)

  const selectorVal = await evalJson(
    sessionId,
    "(()=>{const sr=document.querySelector('openpicker-ui').shadowRoot;const i=sr.querySelector('input[type=text]');return i?i.value:null})()",
  )
  log("locked selector:", JSON.stringify(selectorVal))

  await run(sessionId, clickShadowButton("x.textContent.trim()==='OK'"))
  await sleep(1000)

  // 7. assert the PickResult reached the page
  const result = await evalJson(sessionId, "window.__op.lastRes")
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
    ws?.close()
  } catch {}
  chrome.kill("SIGKILL")
  server.close()
  await sleep(300)
  try {
    rmSync(userDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  } catch {}
}
process.exit(exitCode)
