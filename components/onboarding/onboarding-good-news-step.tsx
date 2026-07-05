"use client"

export function OnboardingGoodNewsStep() {
  return (
    <div className="w-full">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/15 text-3xl shadow-sm shadow-primary/5">
        🦘
      </div>
      <h2 className="font-serif text-2xl font-bold text-foreground">У нас хорошие новости</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Простая привычка учёта помогает тратить осознаннее уже за пару месяцев
      </p>

      <div className="mt-6 rounded-block-sm bg-card p-4 shadow-sm shadow-primary/5">
        <div className="flex h-40 items-end justify-center gap-8 px-2">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-32 w-14 items-end justify-center">
              <div
                className="w-full rounded-t-block-sm bg-[var(--success)] onboarding-bar-rise shadow-sm"
                style={{ height: "88%", animationDelay: "150ms" }}
              />
            </div>
            <p className="max-w-[5.5rem] text-center text-[11px] font-bold leading-tight text-foreground">
              С учётом трат
            </p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-32 w-14 items-end justify-center">
              <div
                className="w-full rounded-t-block-sm bg-muted-foreground/25 onboarding-bar-rise"
                style={{ height: "48%", animationDelay: "350ms" }}
              />
            </div>
            <p className="max-w-[5.5rem] text-center text-[11px] font-bold leading-tight text-muted-foreground">
              Без учёта
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
