/**
 * "Powered by Usertour" attribution, styled after Usertour's own "made with" badge:
 * a small, muted icon + text link. The mark is Usertour's brand glyph, reproduced
 * here purely for attribution; everything else in openpicker is our own.
 */

function UsertourMark({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="#867DB3"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M0 5.5009 6.6867 22.5539 7.4273 3.832z" />
      <path d="M9.1242 3.5109 6.921 22.5797 24 0z" />
    </svg>
  )
}

export function PoweredByUsertour({ className = "" }: { className?: string }) {
  return (
    <a
      href="https://www.usertour.io?utm_source=openpicker&utm_medium=link&utm_campaign=powered-by-usertour"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-slate-400 text-xs no-underline transition-colors hover:text-slate-600 ${className}`}
    >
      <UsertourMark />
      <span>Powered by Usertour</span>
    </a>
  )
}
