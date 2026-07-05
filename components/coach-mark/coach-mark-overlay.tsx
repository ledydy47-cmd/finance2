"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react"
import { scrollElementIntoViewCenter } from "@/lib/scroll-into-view"

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

interface CoachMarkOverlayProps {
  targetRef: RefObject<HTMLElement | null>
  text: string
  onDismiss: () => void
  showNext?: boolean
  nextLabel?: string
  placement?: "above" | "below"
  /** Default 360px; budget hint uses ~540px (1.5×) */
  tooltipMaxWidth?: number
}

function measureTarget(target: HTMLElement, shell: Element, pad = 8): Rect {
  const shellRect = shell.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  return {
    top: targetRect.top - shellRect.top - pad,
    left: targetRect.left - shellRect.left - pad,
    width: targetRect.width + pad * 2,
    height: targetRect.height + pad * 2,
  }
}

export function CoachMarkOverlay({
  targetRef,
  text,
  onDismiss,
  showNext = true,
  nextLabel = "Далее",
  placement = "below",
  tooltipMaxWidth = 360,
}: CoachMarkOverlayProps) {
  const [hole, setHole] = useState<Rect | null>(null)
  const [ready, setReady] = useState(false)
  const scrollTokenRef = useRef(0)

  const measure = useCallback(() => {
    const shell = document.querySelector("[data-app-shell]")
    const target = targetRef.current
    if (!shell || !target) {
      setHole(null)
      return
    }
    setHole(measureTarget(target, shell))
  }, [targetRef])

  useEffect(() => {
    const target = targetRef.current
    if (!target) return

    const token = ++scrollTokenRef.current
    setReady(false)
    setHole(null)

    void scrollElementIntoViewCenter(target).then(() => {
      if (scrollTokenRef.current !== token) return
      measure()
      setReady(true)
    })
  }, [measure, targetRef, text])

  useLayoutEffect(() => {
    if (!ready) return
    measure()
    const t = window.setTimeout(measure, 50)
    return () => window.clearTimeout(t)
  }, [measure, ready])

  useEffect(() => {
    if (!ready) return
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure, ready])

  if (!ready || !hole) return null

  const tooltipTop =
    placement === "below"
      ? Math.min(hole.top + hole.height + 16, 520)
      : Math.max(hole.top - 140, 16)

  return (
    <div className="pointer-events-none absolute inset-0 z-[75]">
      <div
        className="coach-mark-highlight absolute rounded-block-sm ring-4 ring-primary/60 transition-all duration-300 ease-out"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.45)",
        }}
      />

      <div
        className="pointer-events-auto absolute inset-x-2 animate-in fade-in zoom-in-95 duration-300"
        style={{
          top: tooltipTop,
          left: "50%",
          transform: "translateX(-50%)",
          width: `min(calc(100% - 1rem), ${tooltipMaxWidth}px)`,
        }}
      >
        <div className="rounded-block-sm bg-card p-4 shadow-xl shadow-primary/15">
          <p className="text-sm font-semibold leading-relaxed text-foreground">{text}</p>
          {showNext && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-block-sm bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition-transform active:scale-[0.95]"
              >
                {nextLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
