"use client"

interface OnboardingLongTermHabitsStepProps {
  name: string
}

export function OnboardingLongTermHabitsStep({ name }: OnboardingLongTermHabitsStepProps) {
  const displayName = name.trim() || "друг"

  return (
    <div className="w-full">
      <h2 className="text-center font-serif text-xl font-bold leading-snug tracking-tight text-foreground">
        {displayName}, <span className="text-primary">мани.точка</span> формирует привычку копить
        надолго
      </h2>

      <div className="mt-5 overflow-hidden rounded-[1.35rem] bg-white p-5 shadow-lg shadow-primary/10 ring-1 ring-black/[0.04]">
        <p className="font-serif text-base font-semibold text-foreground/85">Ваши финансы</p>

        <div className="relative mt-4">
          <svg
            viewBox="0 0 300 140"
            className="h-auto w-full"
            role="img"
            aria-label="График: с мани.точкой рост, обычные методы — без изменений"
          >
            <defs>
              <linearGradient id="maniGrowthGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="var(--success)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--success)" stopOpacity="0.05" />
              </linearGradient>
            </defs>
            <line x1="28" y1="108" x2="272" y2="108" stroke="var(--border)" strokeWidth="1" />
            <path
              d="M 28 100 L 76 92 L 124 78 L 172 58 L 220 38 L 272 22 L 272 108 L 28 108 Z"
              fill="url(#maniGrowthGradient)"
            />
            <polyline
              points="28,100 76,92 124,78 172,58 220,38 272,22"
              fill="none"
              stroke="var(--success)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="onboarding-line-draw"
            />
            <polyline
              points="28,96 272,92"
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="7 5"
              opacity="0.4"
              className="onboarding-line-draw-delayed"
            />
            <text x="28" y="128" fill="var(--muted-foreground)" fontSize="10" fontWeight="600">
              1-й месяц
            </text>
            <text x="272" y="128" fill="var(--muted-foreground)" fontSize="10" fontWeight="600" textAnchor="end">
              6-й месяц
            </text>
          </svg>

          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-muted-foreground/15 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
              Обычные методы
            </span>
            <span className="rounded-full bg-[var(--success)] px-3 py-1 text-[11px] font-bold text-white shadow-sm shadow-[var(--success)]/30">
              С мани.точкой
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-[color-mix(in_oklch,var(--success)_12%,white)] px-4 py-3.5">
          <span className="text-xl leading-none" aria-hidden>
            ✨
          </span>
          <p className="text-left text-sm font-medium leading-relaxed text-foreground">
            82% пользователей мани.точки продолжают регулярно откладывать деньги даже спустя 6
            месяцев.
          </p>
        </div>
      </div>
    </div>
  )
}
