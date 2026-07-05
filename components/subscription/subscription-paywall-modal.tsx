"use client"

import { Check, Shield, Star, X } from "lucide-react"
import { useState } from "react"
import { useTelegram } from "@/components/telegram/telegram-provider"
import { useFinance } from "@/context/finance-context"
import { getClientUserKey } from "@/lib/client-id"
import {
  PAYWALL_TESTIMONIALS,
  PENDING_PAYMENT_STORAGE_KEY,
  type SubscriptionPlan,
} from "@/lib/subscription"

const TESTIMONIAL_LAYOUT = [
  { className: "left-0 top-0 right-5 z-30 -rotate-1", contentClass: "" },
  { className: "left-5 top-[3.35rem] right-0 z-20 rotate-1", contentClass: "" },
  { className: "left-1 top-[6.7rem] right-3 z-10 -rotate-[0.5deg]", contentClass: "" },
] as const

function PlanRadio({ selected }: { selected: boolean }) {
  if (selected) {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary">
        <Check className="size-3.5 text-primary-foreground" strokeWidth={3} />
      </span>
    )
  }
  return <span className="size-6 shrink-0 rounded-full border-2 border-muted-foreground/30 bg-card" />
}

interface SubscriptionPaywallModalProps {
  onClose: () => void
}

export function SubscriptionPaywallModal({ onClose }: SubscriptionPaywallModalProps) {
  const { openLink, user } = useTelegram()
  const { restoreSubscription } = useFinance()
  const [plan, setPlan] = useState<SubscriptionPlan>("yearly")
  const [paying, setPaying] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setError(null)
    setPaying(true)

    try {
      const orderId = crypto.randomUUID()
      const userKey = getClientUserKey(user?.id)

      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, userKey, orderId }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(
          data.error === "YOOKASSA_NOT_CONFIGURED"
            ? "ЮKassa не настроена на сервере. Добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в Vercel → Settings → Environment Variables и пересоберите проект."
            : data.message ||
              "Оплата временно недоступна. Проверьте настройки ЮKassa на сервере.",
        )
        return
      }

      localStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, data.paymentId)
      openLink(data.confirmationUrl)
    } catch {
      setError("Не удалось создать платёж. Попробуйте ещё раз.")
    } finally {
      setPaying(false)
    }
  }

  async function handleRestore() {
    setError(null)
    setRestoring(true)
    const result = await restoreSubscription()
    setRestoring(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    onClose()
  }

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col px-4 pb-[calc(9.5rem+env(safe-area-inset-bottom))] pt-[max(0.25rem,env(safe-area-inset-top))]">
        <div className="mb-1 flex shrink-0 items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 rounded-full px-1 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
          >
            <X className="size-4" strokeWidth={2.2} />
            Назад
          </button>
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring}
            className="text-[11px] font-semibold text-muted-foreground underline-offset-2 hover:text-primary hover:underline disabled:opacity-50"
          >
            {restoring ? "Проверяем…" : "Восстановить покупки"}
          </button>
        </div>

        <h2 className="shrink-0 text-center font-serif text-[1.35rem] font-bold leading-tight text-foreground">
          Выбери свой план
        </h2>

        <div className="mt-2 flex shrink-0 justify-center gap-0.5" aria-label="5 из 5 звёзд">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-4 fill-amber-400 text-amber-400" strokeWidth={0} />
          ))}
        </div>

        <div className="relative mx-auto mt-3 h-[11.25rem] w-full max-w-[21rem] shrink-0">
          {PAYWALL_TESTIMONIALS.map((review, index) => (
            <article
              key={review.author}
              className={`absolute rounded-block-sm border border-border/70 bg-card px-3.5 py-2.5 shadow-md shadow-primary/10 ${TESTIMONIAL_LAYOUT[index].className}`}
            >
              <div className={TESTIMONIAL_LAYOUT[index].contentClass}>
                <p className="text-[13px] leading-snug text-foreground">«{review.text}»</p>
                <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                  — {review.author}
                </p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col justify-end gap-2.5">
          <div className="relative shrink-0">
            <span className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2 rounded-md bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
              Самый выгодный
            </span>
            <button
              type="button"
              onClick={() => setPlan("yearly")}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 pt-4 text-left transition-all ${
                plan === "yearly"
                  ? "border-2 border-primary bg-primary/10 shadow-sm shadow-primary/10"
                  : "border border-border bg-card shadow-sm shadow-primary/5"
              }`}
            >
              <div className="min-w-0">
                <p className="font-serif text-[15px] font-bold text-foreground">Годовая</p>
                <p className="mt-0.5 text-xs text-muted-foreground">12 мес · 1 490 ₽</p>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <p className="text-right text-sm font-bold text-foreground">124 ₽/мес</p>
                <PlanRadio selected={plan === "yearly"} />
              </div>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setPlan("monthly")}
            className={`flex w-full shrink-0 items-center justify-between gap-3 rounded-2xl px-4 py-3.5 text-left transition-all ${
              plan === "monthly"
                ? "border-2 border-primary bg-primary/10 shadow-sm shadow-primary/10"
                : "border border-border bg-card shadow-sm shadow-primary/5"
            }`}
          >
            <div className="min-w-0">
              <p className="font-serif text-[15px] font-bold text-foreground">Месячная</p>
            </div>
            <div className="flex shrink-0 items-center gap-2.5">
              <p className="text-right text-sm font-bold text-foreground">299 ₽/мес</p>
              <PlanRadio selected={plan === "monthly"} />
            </div>
          </button>

          {error && (
            <p className="shrink-0 rounded-block-sm bg-destructive/10 px-3 py-2 text-center text-[11px] text-destructive">
              {error}
            </p>
          )}

          <p className="flex shrink-0 items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <Shield className="size-3.5 shrink-0 opacity-70" strokeWidth={2.2} />
            Отмена в любой момент · Безопасная оплата
          </p>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 border-t border-border/60 bg-card/95 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
        <button
          type="button"
          onClick={handlePay}
          disabled={paying}
          className="w-full rounded-full bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/30 transition-transform active:scale-[0.98] disabled:opacity-60"
        >
          {paying ? "Создаём платёж…" : "Продолжить"}
        </button>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-x-1 gap-y-1 text-[10px] text-muted-foreground">
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
