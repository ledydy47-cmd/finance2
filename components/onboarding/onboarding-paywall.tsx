"use client"

import { Check, Star } from "lucide-react"
import { useState } from "react"

export type SubscriptionPlan = "yearly" | "monthly"

interface OnboardingPaywallProps {
  onContinue: (plan: SubscriptionPlan) => void
}

function PlanRadio({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
        <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />
      </span>
    )
  }
  return <span className="size-6 shrink-0 rounded-full border-2 border-border bg-card" />
}

export function OnboardingPaywall({ onContinue }: OnboardingPaywallProps) {
  const [plan, setPlan] = useState<SubscriptionPlan>("yearly")

  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto pb-44">
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            className="text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            Восстановить покупки
          </button>
        </div>

        <h2 className="text-center font-serif text-2xl font-bold text-foreground">Выбери свой план</h2>

        <div className="mt-3 flex justify-center gap-0.5" aria-label="5 из 5 звёзд">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-5 fill-amber-400 text-amber-400" strokeWidth={0} />
          ))}
        </div>

        <div className="mt-5 rounded-block-sm bg-card px-4 py-4 shadow-sm shadow-primary/5">
          <p className="text-sm leading-relaxed text-foreground">
            «Раньше я тратила деньги на ерунду, а теперь всё под контролем и я наконец коплю на мечту 💗»
          </p>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">— Аня К.</p>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="relative">
            <span className="absolute -top-2.5 left-4 z-10 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground shadow-sm">
              ВЫГОДНО 🏆
            </span>
            <button
              type="button"
              onClick={() => setPlan("yearly")}
              className={`flex w-full items-center gap-3 rounded-block-sm px-4 py-4 pt-5 text-left transition-all ${
                plan === "yearly"
                  ? "bg-primary/10 ring-2 ring-primary shadow-sm shadow-primary/10"
                  : "bg-card shadow-sm shadow-primary/5"
              }`}
            >
              <PlanRadio selected={plan === "yearly"} />
              <div className="min-w-0 flex-1">
                <p className="font-serif text-base font-bold text-foreground">Годовая подписка</p>
                <p className="text-xs text-muted-foreground">12 мес · 1 490 ₽</p>
              </div>
              <p className="shrink-0 font-serif text-xl font-bold text-foreground">124 ₽/мес</p>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPlan("monthly")}
            className={`flex w-full items-center gap-3 rounded-block-sm px-4 py-4 text-left transition-all ${
              plan === "monthly"
                ? "bg-primary/10 ring-2 ring-primary shadow-sm shadow-primary/10"
                : "bg-card shadow-sm shadow-primary/5"
            }`}
          >
            <PlanRadio selected={plan === "monthly"} />
            <div className="min-w-0 flex-1">
              <p className="font-serif text-base font-bold text-foreground">Месячная</p>
            </div>
            <p className="shrink-0 font-serif text-lg font-bold text-foreground">299 ₽/мес</p>
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Отмена в любой момент · Безопасная оплата
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-border/60 bg-card/95 px-5 pb-8 pt-4 backdrop-blur">
        <button
          type="button"
          onClick={() => onContinue(plan)}
          className="w-full rounded-block-sm bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
        >
          Продолжить
        </button>

        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-[10px] text-muted-foreground">
          <button type="button" className="underline-offset-2 hover:text-primary hover:underline">
            Условия использования
          </button>
          <span aria-hidden>·</span>
          <button type="button" className="underline-offset-2 hover:text-primary hover:underline">
            Политика конфиденциальности
          </button>
        </div>
      </div>
    </>
  )
}
