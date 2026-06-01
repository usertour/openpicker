// End-to-end test for the openpicker extension, driven over the Chrome DevTools
// Protocol with zero dependencies (Node 22+ provides global fetch and WebSocket).
//
// It loads the built extension into headless Chrome and exercises:
//   1. local pick   — ping -> pick -> consent Allow -> hover -> click -> OK, with
//                     an element screenshot, asserting a PickResult.
//   2. cross-tab    — pick({ url }) from a source tab opens a target tab, the pick
//                     runs there, and the result routes back to the source tab.
//
// To guarantee the content script injects, we connect at the browser level, wait
// for the extension's service worker to register, and only then open tabs.
//
// Usage: node e2e/run.mjs [path-to-unpacked-extension]
// Override Chrome with OPENPICKER_CHROME=/path/to/chrome.

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

async function attach(targetId) {
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true })
  await send("Runtime.enable", {}, sessionId)
  await send("Page.enable", {}, sessionId)
  return sessionId
}

async function waitInjected(sessionId) {
  for (let i = 0; i < 30; i++) {
    await sleep(300)
    if ((await evalJson(sessionId, "document.documentElement.dataset.openpicker || null")) === "loaded")
      return true
  }
  return false
}

// Drive the picker UI in whichever tab it mounted: Allow -> hover -> click -> OK.
async function drivePicker(sessionId) {
  for (let i = 0; i < 25; i++) {
    await sleep(300)
    const s = await evalJson(sessionId, "window.__opShadow ? window.__opShadow() : {host:false}")
    if (s?.host) break
  }
  await run(sessionId, clickShadowButton("/Allow/.test(x.textContent)"))
  await sleep(800)
  await run(sessionId, dispatchAt("cta", "mousemove", "MouseEvent"))
  await sleep(400)
  await run(sessionId, dispatchAt("cta", "pointerdown", "PointerEvent"))
  await sleep(1000)
  const selector = await evalJson(
    sessionId,
    "(()=>{const sr=document.querySelector('openpicker-ui').shadowRoot;const i=sr.querySelector('input[type=text]');return i?i.value:null})()",
  )
  await run(sessionId, clickShadowButton("x.textContent.trim()==='OK'"))
  return selector
}

let exitCode = 1
try {
  // browser-level CDP + auto-attach so we see new tabs (cross-tab target).
  let browserWsUrl
  for (let i = 0; i < 40 && !browserWsUrl; i++) {
    await sleep(500)
    try {
      browserWsUrl = (await (await fetch(`http://localhost:${DEBUG_PORT}/json/version`)).json())
        .webSocketDebuggerUrl
    } catch {}
  }
  if (!browserWsUrl) throw new Error("no browser CDP endpoint")

  const attachedTargets = []
  ws = new WebSocket(browserWsUrl)
  await new Promise((res, rej) => {
    ws.addEventListener("open", res, { once: true })
    ws.addEventListener("error", rej, { once: true })
  })
  ws.addEventListener("message", (ev) => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const r = pending.get(m.id)
      pending.delete(m.id)
      r(m.result ?? m.error)
      return
    }
    if (m.method === "Target.targetCreated" && m.params.targetInfo.type === "page") {
      attachedTargets.push(m.params.targetInfo)
    }
  })
  await send("Target.setDiscoverTargets", { discover: true })

  // wait for the extension's service worker
  let swReady = false
  for (let i = 0; i < 40 && !swReady; i++) {
    await sleep(500)
    const list = await (await fetch(`http://localhost:${DEBUG_PORT}/json`)).json()
    swReady = list.some((t) => t.type === "service_worker" && t.url.startsWith("chrome-extension://"))
  }
  log("extension service worker:", swReady ? "ready" : "NOT FOUND")

  // ---- Test 1: local pick + element screenshot ----
  const t1 = await send("Target.createTarget", { url: FIXTURE_URL })
  const s1 = await attach(t1.targetId)
  log("source content script:", (await waitInjected(s1)) ? "injected" : "NOT injected")

  await run(s1, "window.__opPing()")
  let pong = null
  for (let i = 0; i < 20 && !pong; i++) {
    await sleep(300)
    pong = await evalJson(s1, "window.__op.pong")
  }
  const pingOk = !!pong && pong.capabilities?.includes("openUrl")
  log("ping:", pingOk ? "ok" : "FAILED", JSON.stringify(pong))

  await run(s1, "window.__opPick({screenshot:'element'})")
  const sel1 = await drivePicker(s1)
  await sleep(800)
  const r1 = await evalJson(s1, "window.__op.lastRes")
  const localOk =
    typeof sel1 === "string" &&
    sel1.length > 0 &&
    r1?.ok === true &&
    r1.result?.element?.tag === "button" &&
    typeof r1.result?.screenshot === "string" &&
    r1.result.screenshot.startsWith("data:image/")
  log("local pick:", localOk ? "ok" : "FAILED", "selector=", JSON.stringify(sel1), "hasShot=", !!r1?.result?.screenshot)

  // ---- Test 2: cross-tab pick ----
  const before = attachedTargets.length
  await run(s1, `window.__opPick({ url: ${JSON.stringify(FIXTURE_URL)} })`)
  // wait for the target tab to be created and injected
  let targetSession
  for (let i = 0; i < 40 && !targetSession; i++) {
    await sleep(400)
    if (attachedTargets.length > before) {
      const tgt = attachedTargets[attachedTargets.length - 1]
      const sid = await attach(tgt.targetId)
      if (await waitInjected(sid)) targetSession = sid
    }
  }
  log("cross-tab target opened:", targetSession ? "yes" : "NO")

  let crossOk = false
  if (targetSession) {
    const sel2 = await drivePicker(targetSession)
    await sleep(1200)
    const r2 = await evalJson(s1, "window.__op.lastRes") // result routes back to SOURCE tab
    crossOk =
      typeof sel2 === "string" &&
      sel2.length > 0 &&
      r2?.ok === true &&
      r2.result?.element?.tag === "button"
    log("cross-tab pick:", crossOk ? "ok" : "FAILED", "selector=", JSON.stringify(sel2))
  }

  const allOk = pingOk && localOk && crossOk
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
