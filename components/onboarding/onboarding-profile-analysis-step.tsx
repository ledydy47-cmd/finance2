"use client"

import { Check } from "lucide-react"
import { useEffect, useState } from "react"
import { PROFILE_ANALYSIS_STEPS } from "@/lib/onboarding"

interface OnboardingProfileAnalysisStepProps {
  onComplete: () => void
  stepEnterClass: string
}

const STEP_DELAY_MS = 850
const FINISH_DELAY_MS = 600

export function OnboardingProfileAnalysisStep({
  onComplete,
  stepEnterClass,
}: OnboardingProfileAnalysisStepProps) {
  const [visibleCount, setVisibleCount] = useState(0)

  useEffect(() => {
    setVisibleCount(0)
    const timers: number[] = []

    PROFILE_ANALYSIS_STEPS.forEach((_, index) => {
      timers.push(
        window.setTimeout(() => {
          setVisibleCount(index + 1)
        }, STEP_DELAY_MS * (index + 1)),
      )
    })

    timers.push(
      window.setTimeout(() => {
        onComplete()
      }, STEP_DELAY_MS * PROFILE_ANALYSIS_STEPS.length + FINISH_DELAY_MS),
    )

    return () => timers.forEach((id) => window.clearTimeout(id))
  }, [onComplete])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-onboarding-scroll>
      <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className={`w-full max-w-sm text-center ${stepEnterClass}`}>
          <h2 className="font-serif text-2xl font-bold text-foreground">
            Настраиваем приложение под тебя
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Секундочку...</p>

          <div className="relative mx-auto mt-8 flex size-24 items-center justify-center">
            <span
              className="absolute inset-0 rounded-full border-4 border-primary/15"
              aria-hidden
            />
            <span
              className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary onboarding-analysis-spinner"
              aria-hidden
            />
            <span className="font-serif text-2xl font-bold text-primary">
              {Math.min(visibleCount, PROFILE_ANALYSIS_STEPS.length)}
            </span>
          </div>

          <ul className="mt-8 flex flex-col gap-3 text-left">
            {PROFILE_ANALYSIS_STEPS.map((label, index) => {
              const done = index < visibleCount
              const active = index === visibleCount - 1 && !label.startsWith("Готово")
              return (
                <li
                  key={label}
                  className={`flex items-center gap-3 rounded-block-sm px-4 py-3 transition-all duration-300 ${
                    done
                      ? "bg-primary/10 text-foreground"
                      : "bg-secondary/60 text-muted-foreground"
                  } ${done ? "animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both" : ""}`}
                  style={done ? { animationDelay: `${index * 40}ms` } : undefined}
                >
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full transition-colors ${
                      done ? "bg-primary text-primary-foreground" : "bg-muted"
                    } ${active ? "onboarding-analysis-pulse" : ""}`}
                  >
                    {done ? (
                      <Check className="size-3.5" strokeWidth={3} />
                    ) : (
                      <span className="size-1.5 rounded-full bg-muted-foreground/40" />
                    )}
                  </span>
                  <span className="text-sm font-semibold">{label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
