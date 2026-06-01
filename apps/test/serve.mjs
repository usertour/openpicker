// Tiny zero-dependency static server for the openpicker test page.
// Serves apps/test/ over http so the content script's same-origin check passes
// (file:// would have origin "null" and be rejected).
//
//   pnpm test:page          # serves on http://localhost:5599
//   PORT=8080 pnpm test:page

import { readFile } from "node:fs/promises"
import http from "node:http"
import { dirname, join, normalize } from "node:path"
import { fileURLToPath } from "node:url"

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 5599)

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }

const server = http.createServer(async (req, res) => {
  const rawPath = (req.url ?? "/").split("?")[0]
  const rel = rawPath === "/" ? "/index.html" : rawPath
  // Prevent path traversal; only serve from this directory.
  const filePath = normalize(join(HERE, rel))
  if (!filePath.startsWith(HERE)) {
    res.writeHead(403).end("forbidden")
    return
  }
  try {
    const body = await readFile(filePath)
    const ext = filePath.slice(filePath.lastIndexOf("."))
    res.writeHead(200, { "content-type": TYPES[ext] ?? "application/octet-stream" })
    res.end(body)
  } catch {
    res.writeHead(404).end("not found")
  }
})

server.listen(PORT, () => {
  console.log(`openpicker test page: http://localhost:${PORT}/`)
  console.log("Load the unpacked extension, then open that URL.")
})
