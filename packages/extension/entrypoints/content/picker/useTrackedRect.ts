import { useEffect, useState } from "react"

/**
 * Track an element's viewport rectangle across a requestAnimationFrame loop, so
 * the highlight follows scroll, resize, and layout changes. Returns null when no
 * element is given.
 */
export function useTrackedRect(el: Element | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!el) {
      setRect(null)
      return
    }
    let raf = 0
    let prevKey = ""
    const tick = () => {
      const r = el.getBoundingClientRect()
      const key = `${r.top},${r.left},${r.width},${r.height}`
      if (key !== prevKey) {
        prevKey = key
        setRect(r)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [el])

  return rect
}
