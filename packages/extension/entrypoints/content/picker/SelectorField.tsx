import { type SelectorTokenType, tokenizeSelector } from "@openpicker/protocol"
import { RiCheckLine, RiFileCopyLine, RiLock2Line } from "@remixicon/react"
import { useMemo, useState } from "react"
import { i18n } from "#i18n"

/**
 * The selector readout — the picker's hero. A syntax-highlighted field that stays
 * fully editable: a transparent <textarea> sits over a colored highlight layer that
 * mirrors its text, so the selector is always both editable (real caret + selection)
 * and colored. The two layers share identical text metrics so they stay
 * pixel-aligned, and the highlight layer (in normal flow) defines the box height.
 * A copy button and the match/validity status live in the same card. See DESIGN.md §5.1c.
 */

const TOKEN_CLASS: Record<SelectorTokenType, string> = {
  tag: "text-pink-700 dark:text-pink-300",
  id: "text-accent-600 dark:text-accent-400",
  class: "text-sky-600 dark:text-sky-300",
  attrName: "text-amber-700 dark:text-amber-300",
  attrValue: "text-amber-700 dark:text-amber-300",
  pseudo: "text-emerald-600 dark:text-emerald-300",
  combinator: "text-slate-400 dark:text-slate-500",
  punctuation: "text-slate-400 dark:text-slate-500",
}

// The highlight layer and the textarea MUST share these exact metrics, or the caret
// drifts off the glyphs. The card supplies the outer padding; `pr-6` reserves room
// for the copy button.
const FIELD_TEXT = "pr-6 font-mono text-xs leading-[1.5] whitespace-pre-wrap break-all"

interface SelectorFieldProps {
  value: string
  /** Editable once an element is locked; a read-only live preview while hovering. */
  editable: boolean
  placeholder?: string
  onChange?: (value: string) => void
  /** How many elements the selector matches (for the status pill). */
  matchCount: number
  /** False when the selector is not valid CSS. */
  selectorValid: boolean
  /** SDK locked editing: show a "locked by the site" hint (the field is read-only). */
  lockedBySite?: boolean
}

function StatusPill({ matchCount, valid }: { matchCount: number; valid: boolean }) {
  const tone = !valid
    ? "border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400"
    : matchCount === 1
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : "border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400"
  const dot = !valid ? "bg-rose-500" : matchCount === 1 ? "bg-emerald-500" : "bg-amber-500"
  return (
    <span
      className={`mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border py-0.5 pr-2.5 pl-2 font-medium font-mono text-[11px] ${tone}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dot} ring-2 ring-current/20`} />
      {valid ? i18n.t("picker.matchCount", matchCount) : i18n.t("picker.invalidSelector")}
    </span>
  )
}

export function SelectorField({
  value,
  editable,
  placeholder,
  onChange,
  matchCount,
  selectorValid,
  lockedBySite,
}: SelectorFieldProps) {
  const [copied, setCopied] = useState(false)
  // Key each token by its start offset (unique + stable, not the array index).
  const tokens = useMemo(() => {
    let offset = 0
    return tokenizeSelector(value).map((t) => {
      const key = offset
      offset += t.text.length
      return { ...t, key }
    })
  }, [value])

  const copy = (): void => {
    navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      })
      .catch(() => {})
  }

  return (
    <div
      className={`flex-1 rounded-lg border px-2.5 py-2 transition focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/30 ${
        editable
          ? "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
          : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
      }`}
    >
      <div className="relative">
        {/* Colored layer — defines the height; never receives pointer events. */}
        <div
          aria-hidden
          className={`${FIELD_TEXT} pointer-events-none text-slate-800 dark:text-slate-100`}
        >
          {tokens.length === 0 ? (
            <span>{"​"}</span>
          ) : (
            tokens.map((t) => (
              <span key={t.key} className={TOKEN_CLASS[t.type]}>
                {t.text}
              </span>
            ))
          )}
        </div>
        {/* Editable overlay — transparent text, accent caret, sits exactly on top. */}
        <textarea
          value={value}
          readOnly={!editable}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          rows={1}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          className={`${FIELD_TEXT} absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-accent-600 outline-none placeholder:text-slate-400 dark:caret-accent-400 dark:placeholder:text-slate-500`}
        />
        {value && (
          <button
            type="button"
            onClick={copy}
            title={copied ? i18n.t("picker.copied") : i18n.t("picker.copy")}
            className="absolute top-0 right-0 grid h-6 w-6 place-items-center rounded-md border border-slate-200 bg-white/70 text-slate-400 backdrop-blur transition-colors hover:border-accent-300 hover:text-accent-600 dark:border-slate-700 dark:bg-slate-900/70 dark:hover:border-accent-700 dark:hover:text-accent-300"
          >
            {copied ? (
              <RiCheckLine size={13} className="text-emerald-500" />
            ) : (
              <RiFileCopyLine size={13} />
            )}
          </button>
        )}
      </div>
      {value && <StatusPill matchCount={matchCount} valid={selectorValid} />}
      {lockedBySite && (
        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
          <RiLock2Line size={11} />
          {i18n.t("settings.lockedBySite")}
        </div>
      )}
    </div>
  )
}
