"use client"

interface OnboardingLongTermHabitsStepProps {
  name: string
}

export function OnboardingLongTermHabitsStep({ name }: OnboardingLongTermHabitsStepProps) {
  const displayName = name.trim() || "друг"

  return (
    <div className="w-full">
      <h2 className="font-serif text-xl font-bold leading-snug text-foreground">
        {displayName}, привычка учёта работает вдолгую
      </h2>

      <div className="mt-5 rounded-block-sm bg-card p-4 shadow-sm shadow-primary/5">
        <p className="mb-3 font-serif text-sm font-bold text-foreground">Твои финансы</p>
        <svg
          viewBox="0 0 280 120"
          className="h-auto w-full"
          role="img"
          aria-label="График: с приложением растёт, обычный подход flat"
        >
          <line x1="24" y1="96" x2="256" y2="96" stroke="var(--border)" strokeWidth="1" />
          <polyline
            points="24,88 72,82 120,72 168,58 216,42 256,28"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="onboarding-line-draw"
          />
          <polyline
            points="24,84 256,80"
            fill="none"
            stroke="var(--muted-foreground)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 4"
            opacity="0.45"
            className="onboarding-line-draw-delayed"
          />
        </svg>
        <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-primary">
            <span className="size-2 rounded-full bg-primary" />
            С приложением
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-muted-foreground/40" />
            Обычный подход
          </span>
        </div>
      </div>

      <div className="mt-4 rounded-block-sm bg-primary/10 px-4 py-3.5 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">
        <p className="text-sm font-medium leading-relaxed text-foreground">
          Регулярный учёт помогает сохранять финансовые привычки надолго.
        </p>
      </div>
    </div>
  )
}
