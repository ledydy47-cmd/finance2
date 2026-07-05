"use client"

import { TRACKING_STATS, TRACKING_WEEK_ITEMS } from "@/lib/onboarding"
import { THEMES } from "@/lib/themes"

export function OnboardingTracking30DaysStep() {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-white text-4xl shadow-md shadow-primary/10 ring-1 ring-black/[0.04]">
        📊
      </div>
      <h2 className="font-serif text-2xl font-bold text-foreground">Веди учёт трат 30 дней</h2>
      <p className="mt-2 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
        Осознанный учёт помогает тратить меньше — в среднем до 23% в месяц
      </p>

      <ul className="mt-5 flex w-full flex-col gap-2.5 text-left">
        {TRACKING_WEEK_ITEMS.map((item, index) => {
          const accent = THEMES[item.themeId].vars.primary
          const accentSoft = THEMES[item.themeId].vars.secondary

          return (
            <li
              key={item.week}
              className="rounded-block-sm px-3.5 py-3 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both"
              style={{
                backgroundColor: accentSoft,
                animationDelay: `${index * 90}ms`,
              }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-2xl shadow-sm"
                  aria-hidden
                >
                  {item.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold" style={{ color: accent }}>
                    {item.label}
                  </p>
                  <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{item.text}</p>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/70">
                    <div
                      className="h-full rounded-full onboarding-bar-grow origin-left"
                      style={{
                        width: `${item.progress}%`,
                        backgroundColor: accent,
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

      <div className="mt-5 flex w-full items-stretch justify-between gap-1 rounded-block-sm bg-primary/10 px-2 py-4">
        {TRACKING_STATS.map((stat) => (
          <div key={stat.label} className="min-w-0 flex-1 px-1">
            <p className="font-serif text-3xl font-bold leading-none text-primary">{stat.value}</p>
            <p className="mt-1.5 text-[10px] font-semibold leading-tight text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
