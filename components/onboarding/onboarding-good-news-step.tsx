"use client"

import { OnboardingMascot } from "@/components/onboarding/onboarding-mascot"

export function OnboardingGoodNewsStep() {
  return (
    <div className="flex w-full flex-col items-center text-center">
      <div className="mb-5">
        <OnboardingMascot size="hero" />
      </div>

      <h2 className="font-serif text-2xl font-bold text-foreground">У нас отличные новости!</h2>
      <p className="mt-3 max-w-[20rem] text-sm leading-relaxed text-muted-foreground">
        Внедрите простые полезные привычки, и с Мани.точка вы легко превзойдёте средний результат
        всего за 66 дней.
      </p>

      <div className="mt-6 w-full rounded-block-sm bg-card p-5 shadow-md shadow-primary/8">
        <div className="flex h-52 items-end justify-center gap-10 px-2">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-44 w-[4.5rem] items-end justify-center">
              <div
                className="relative w-full rounded-t-2xl bg-[var(--success)] onboarding-bar-rise shadow-lg shadow-[var(--success)]/25"
                style={{ height: "86%", animationDelay: "150ms" }}
              >
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-lg font-bold text-[var(--success)]">
                  86%
                </span>
              </div>
            </div>
            <p className="max-w-[6rem] text-center text-xs font-bold leading-tight text-foreground">
              Вы
            </p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-44 w-[4.5rem] items-end justify-center">
              <div
                className="relative w-full rounded-t-2xl bg-muted-foreground/20 onboarding-bar-rise"
                style={{ height: "50%", animationDelay: "350ms" }}
              >
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap font-serif text-lg font-bold text-muted-foreground">
                  50%
                </span>
              </div>
            </div>
            <p className="max-w-[6rem] text-center text-xs font-bold leading-tight text-muted-foreground">
              Средний показатель
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
