"use client"

import { Check, Star, X } from "lucide-react"
import { useState } from "react"
import { useTelegram } from "@/components/telegram/telegram-provider"
import {
  PAYWALL_TESTIMONIALS,
  YOOMONEY_PAYMENT_URL,
  type SubscriptionPlan,
} from "@/lib/subscription"

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

interface SubscriptionPaywallModalProps {
  onClose: () => void
  onSubscribe: (plan: SubscriptionPlan) => void
}

export function SubscriptionPaywallModal({ onClose, onSubscribe }: SubscriptionPaywallModalProps) {
  const { openLink } = useTelegram()
  const [plan, setPlan] = useState<SubscriptionPlan>("yearly")
  const [reviewIndex, setReviewIndex] = useState(0)
  const review = PAYWALL_TESTIMONIALS[reviewIndex]

  function handlePay() {
    openLink(YOOMONEY_PAYMENT_URL)
  }

  function handleRestore() {
    onSubscribe(plan)
  }

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-background">
      <div className="flex flex-1 flex-col overflow-y-auto pb-44">
        <div className="mb-2 flex items-center justify-between px-1 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-full px-2 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <X className="size-4" strokeWidth={2.2} />
            Назад
          </button>
          <button
            type="button"
            onClick={handleRestore}
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
          <p className="text-sm leading-relaxed text-foreground">«{review.text}»</p>
          <p className="mt-2 text-xs font-semibold text-muted-foreground">— {review.author}</p>
          <div className="mt-3 flex justify-center gap-1.5">
            {PAYWALL_TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Отзыв ${i + 1}`}
                onClick={() => setReviewIndex(i)}
                className={`size-1.5 rounded-full transition-colors ${
                  i === reviewIndex ? "bg-primary" : "bg-border"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3">
          <div className="relative">
            <span className="absolute -top-2.5 left-4 z-10 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-primary-foreground shadow-sm">
              Самый выгодный 🏆
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
                <p className="font-serif text-base font-bold text-foreground">Годовая</p>
                <p className="text-xs text-muted-foreground">12 мес · 1 490 ₽ · 124 ₽/мес</p>
              </div>
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
              <p className="text-xs text-muted-foreground">299 ₽/мес</p>
            </div>
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Отмена в любой момент · Безопасная оплата через ЮMoney
        </p>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-border/60 bg-card/95 px-5 pb-8 pt-4 backdrop-blur">
        <button
          type="button"
          onClick={handlePay}
          className="w-full rounded-block-sm bg-primary py-4 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98]"
        >
          Оплатить через ЮMoney
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
    </div>
  )
}

export type { SubscriptionPlan }
