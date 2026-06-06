import { SelectorRulesFields as SharedSelectorRulesFields } from "@openpicker/selector-rules-ui"
import { i18n } from "#i18n"
import type { SelectorSettings } from "./selectorSettings"

/**
 * Extension wrapper around the shared {@link SharedSelectorRulesFields}: injects the
 * localized labels and passes the extension's resolved {@link SelectorSettings}
 * straight through (structurally identical to the shared `SelectorRules`). The actual
 * editor lives in @openpicker/selector-rules-ui so the gear popover, the options page,
 * and the demo all render the exact same UI. See DESIGN.md §5.1f.
 */
export function SelectorRulesFields({
  settings,
  onChange,
  readOnly = false,
}: {
  settings: SelectorSettings
  onChange: (patch: Partial<SelectorSettings>) => void
  readOnly?: boolean
}) {
  return (
    <SharedSelectorRulesFields
      value={settings}
      onChange={onChange}
      readOnly={readOnly}
      labels={{
        enableId: i18n.t("settings.enableId"),
        enableClass: i18n.t("settings.enableClass"),
        enableAttribute: i18n.t("settings.enableAttribute"),
        enableTag: i18n.t("settings.enableTag"),
        allow: i18n.t("settings.allow"),
        ignore: i18n.t("settings.ignore"),
        regexHint: i18n.t("settings.regexHint"),
      }}
    />
  )
}
