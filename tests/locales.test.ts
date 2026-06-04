import { readdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { parse } from "yaml"

/**
 * Guards the extension's i18n: every locale must parse as YAML and carry exactly
 * the same key set as the source `en.yml`. This catches translation drift (a
 * missing or stray key) and YAML mistakes (e.g. an unquoted colon read as a nested
 * map) before they ship as a silently-untranslated string.
 */

const localesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "packages",
  "extension",
  "locales",
)

/** Recursively collect leaf key paths (e.g. "picker.matchCount.n"), sorted. */
function leafKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix]
  }
  const out: string[] = []
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    out.push(...leafKeys(child, path))
  }
  return out.sort()
}

function load(file: string): Record<string, unknown> {
  return parse(readFileSync(join(localesDir, file), "utf8")) as Record<string, unknown>
}

const files = readdirSync(localesDir).filter((f) => f.endsWith(".yml"))
const enKeys = leafKeys(load("en.yml"))

describe("extension locales", () => {
  it("ships en.yml plus the full translated set", () => {
    expect(files).toContain("en.yml")
    // en + 13 translations.
    expect(files.length).toBeGreaterThanOrEqual(14)
  })

  it("en.yml has a non-empty key set", () => {
    expect(enKeys.length).toBeGreaterThan(0)
  })

  const translations = files.filter((f) => f !== "en.yml")
  it.each(translations)("%s parses and matches en.yml keys exactly", (file) => {
    expect(leafKeys(load(file))).toEqual(enKeys)
  })
})
