import React from "react"
import ReactDOM from "react-dom/client"
import { watchTheme } from "@/lib/theme"
import { App } from "./App"
import "./style.css"

watchTheme(document.documentElement)

const root = document.getElementById("root")
if (!root) throw new Error("openpicker options: #root not found")

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
