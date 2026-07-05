"use client"

import { Calculator } from "lucide-react"
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { useFinance } from "@/context/finance-context"
import { scrollElementIntoViewCenter } from "@/lib/scroll-into-view"

const STEPS: {
  target: string
  renderText: () => ReactNode
}[] = [
  {
    target: "[data-tour='ghost-goal']",
    renderText: () => <>Здесь твоя мечта 💗 Нажми, чтобы добавить первую цель</>,
  },
  {
    target: "[data-tour='budget-planner']",
    renderText: () => (
      <>
        Теперь спланируем бюджет{" "}
        <Calculator className="inline size-[1.1em] align-[-0.15em] text-primary" strokeWidth={2.2} />
        {" "}
        Нажми сюда
      </>
    ),
  },
  {
    target: "[data-tour='add-button']",
    renderText: () => <>Готово! Добавляй свои траты этой кнопкой 💗</>,
  },
]

interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export function HomeWalkthrough() {
  const { homeSetupStep, skipHomeSetup, completeHomeWalkthrough } = useFinance()
  const stepIndex = homeSetupStep - 1
  const current = STEPS[stepIndex]
  const [hole, setHole] = useState<Rect | null>(null)
  const [ready, setReady] = useState(false)
  const scrollTokenRef = useRef(0)

  const measure = useCallback(() => {
    if (!current) return
    const shell = document.querySelector("[data-app-shell]")
    const target = document.querySelector(current.target)
    if (!shell || !target) {
      setHole(null)
      return
    }

    const shellRect = shell.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()
    const pad = 8

    setHole({
      top: targetRect.top - shellRect.top - pad,
      left: targetRect.left - shellRect.left - pad,
      width: targetRect.width + pad * 2,
      height: targetRect.height + pad * 2,
    })
  }, [current])

  useEffect(() => {
    if (!current) return

    const token = ++scrollTokenRef.current
    setReady(false)
    setHole(null)

    const target = document.querySelector(current.target)
    if (!target) return

    void scrollElementIntoViewCenter(target).then(() => {
      if (scrollTokenRef.current !== token) return
      measure()
      setReady(true)
    })
  }, [current, homeSetupStep, measure])

  useLayoutEffect(() => {
    if (!ready) return
    measure()
  }, [measure, ready, homeSetupStep])

  useEffect(() => {
    if (!ready) return
    window.addEventListener("resize", measure)
    return () => window.removeEventListener("resize", measure)
  }, [measure, ready])

  if (!current) return null

  const tooltipTop = hole ? Math.min(hole.top + hole.height + 14, 500) : 200
  const arrowLeft = hole ? hole.left + hole.width / 2 - 8 : 24

  return (
    <div className="pointer-events-none absolute inset-0 z-[60]">
      {ready && hole && (
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
      )}

      {ready && hole && (
        <div
          className="pointer-events-auto absolute inset-x-5 animate-in fade-in zoom-in-95 duration-300"
          style={{ top: tooltipTop }}
        >
          <span
            className="absolute -top-2 size-0 border-x-8 border-b-8 border-x-transparent border-b-card"
            style={{ left: Math.max(16, Math.min(arrowLeft - 16, 280)) }}
            aria-hidden
          />
          <div className="rounded-block-sm bg-card p-4 shadow-xl shadow-primary/15">
            <p className="text-sm font-semibold leading-relaxed text-foreground">{current.renderText()}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={skipHomeSetup}
                className="text-xs font-semibold text-muted-foreground underline-offset-2 transition-transform active:scale-95 hover:text-primary hover:underline"
              >
                Пропустить
              </button>
              {homeSetupStep === 3 && (
                <button
                  type="button"
                  onClick={completeHomeWalkthrough}
                  className="rounded-block-sm bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground transition-transform active:scale-[0.95]"
                >
                  Понятно
                </button>
              )}
            </div>
            <p className="mt-3 text-center text-[10px] text-muted-foreground">
              {homeSetupStep} / {STEPS.length}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
