"use client"

import {
  Brain,
  PenLine,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import { TRACKING_STATS, TRACKING_WEEK_ITEMS } from "@/lib/onboarding"

const WEEK_ICONS: Record<(typeof TRACKING_WEEK_ITEMS)[number]["icon"], LucideIcon> = {
  PenLine,
  Search,
  Brain,
  Sparkles,
}

export function OnboardingTracking30DaysStep() {
  return (
    <div className="w-full">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/15 text-3xl shadow-sm shadow-primary/5">
        📊
      </div>
      <h2 className="font-serif text-2xl font-bold text-foreground">Веди учёт трат 30 дней</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Осознанный учёт помогает тратить меньше — в среднем до 23% в месяц
      </p>

      <ul className="mt-5 flex flex-col gap-2.5">
        {TRACKING_WEEK_ITEMS.map((item, index) => {
          const Icon = WEEK_ICONS[item.icon]
          return (
            <li
              key={item.week}
              className="rounded-block-sm bg-card px-3.5 py-3 shadow-sm shadow-primary/5 animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
              style={{ animationDelay: `${index * 90}ms` }}
            >
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Icon className="size-4 text-primary" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-primary">{item.label}</p>
                  <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{item.text}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary onboarding-bar-grow origin-left"
                      style={{
                        width: `${item.progress}%`,
                        animationDelay: `${index * 120 + 200}ms`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="mt-5 flex items-center justify-between gap-2 rounded-block-sm bg-primary/10 px-3 py-3 text-center">
        {TRACKING_STATS.map((stat, index) => (
          <div key={stat.label} className="min-w-0 flex-1">
            <p className="font-serif text-base font-bold text-primary">{stat.value}</p>
            <p className="text-[10px] font-semibold text-muted-foreground">{stat.label}</p>
            {index < TRACKING_STATS.length - 1 && (
              <span className="sr-only">·</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
