"use client"

import { Check, Shield, Star, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { useTelegram } from "@/components/telegram/telegram-provider"
import { SupportSection } from "@/components/support/support-section"
import { useFinance } from "@/context/finance-context"
import { getClientUserKey } from "@/lib/client-id"
import { triggerFlashSaleReminderCheck } from "@/lib/client/flash-sale-reminder-client"
import { getFlashSaleState, FLASH_SALE_REMINDER_DELAY_MS } from "@/lib/paywall-experiment"
import {
  getPaywallDisplayPrices,
  type PaywallPlanDisplayPrices,
} from "@/lib/paywall-pricing"
import {
  PAYWALL_TESTIMONIALS,
  PENDING_ORDER_ID_KEY,
  PENDING_PAYMENT_STORAGE_KEY,
  type SubscriptionPlan,
} from "@/lib/subscription"

import { getPaywallPaymentNote } from "@/lib/currency"

const TESTIMONIAL_LAYOUT = [
  { className: "-rotate-1 mr-5" },
  { className: "rotate-1 ml-5 -mt-1" },
  { className: "-rotate-[0.5deg] mx-2 -mt-1" },
] as const

function formatRub(value: number) {
  return `${value.toLocaleString("ru-RU")} ₽`
}

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

function PlanDiscountBadge({
  label = "−50%",
  className = "",
}: {
  label?: string
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm ${className}`}
    >
      {label}
    </span>
  )
}

function FlashSaleBadge({
  label = "−50%",
  className = "",
}: {
  label?: string
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-destructive px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] text-white shadow-lg shadow-destructive/35 ${className}`}
    >
      {label}
    </span>
  )
}

function FlashSaleBanner({
  countdownLabel,
  title,
  badgeLabel,
  showForeverBadge = true,
  subtitle,
}: {
  countdownLabel: string
  title?: string
  badgeLabel?: string
  showForeverBadge?: boolean
  subtitle?: string
}) {
  return (
    <div className="relative mb-3 shrink-0 overflow-hidden rounded-2xl border-2 border-destructive/35 bg-gradient-to-br from-destructive/20 via-destructive/10 to-background px-4 py-4 text-center shadow-lg shadow-destructive/15">
      <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-destructive/15 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-4 size-20 rounded-full bg-destructive/10 blur-2xl" />

      <div className="relative flex items-center justify-center gap-2">
        <FlashSaleBadge label={badgeLabel} className="px-3 py-1.5 text-xs" />
        {showForeverBadge ? (
          <span className="rounded-full bg-destructive/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-destructive">
            навсегда
          </span>
        ) : null}
      </div>

      <p className="relative mt-3 font-serif text-[1.05rem] font-bold leading-snug text-foreground">
        {title ?? "Зафиксируй скидку на всё время подписки"}
      </p>
      <p className="relative mt-1.5 text-sm leading-relaxed text-muted-foreground">
        {subtitle ?? (
          <>
            Оформи сейчас — и цена{" "}
            <span className="font-bold text-destructive">останется такой навсегда</span>, даже при
            продлении
          </>
        )}
      </p>

      <div className="relative mt-3 inline-flex min-w-[9.5rem] items-center justify-center rounded-full border border-destructive/30 bg-background/90 px-4 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Осталось
        </span>
        <span className="ml-2 font-mono text-lg font-extrabold tabular-nums text-destructive">
          {countdownLabel}
        </span>
      </div>
    </div>
  )
}

function PlanPrice({ prices }: { prices: PaywallPlanDisplayPrices }) {
  const perMonthLabel = `${prices.perMonth} ₽/мес`

  if (!prices.showDiscount || !prices.listPerMonth) {
    return (
      <p className="text-right text-lg font-extrabold tracking-tight text-foreground">{perMonthLabel}</p>
    )
  }

  return (
    <div className="text-right">
      <p className="text-xs font-semibold text-muted-foreground line-through">
        {prices.listPerMonth} ₽/мес
      </p>
      <p className="text-lg font-extrabold tracking-tight text-primary">{perMonthLabel}</p>
    </div>
  )
}

interface SubscriptionPaywallModalProps {
  onClose: () => void
}

export function SubscriptionPaywallModal({ onClose }: SubscriptionPaywallModalProps) {
  const { openLink, user } = useTelegram()
  const { data, restoreSubscription, refreshSubscriptionAfterExternalPayment } = useFinance()
  const [plan, setPlan] = useState<SubscriptionPlan>("yearly")
  const [paying, setPaying] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const pricing = useMemo(
    () =>
      getPaywallDisplayPrices({
        settings: data.settings,
        now,
      }),
    [data.settings, now],
  )

  const flashSaleActive = pricing.phase === "flash_sale"
  const flashSale = getFlashSaleState(data.settings, now)
  const isSept1Promo = pricing.promotionId === "sept1_2026"
  const discountBadgeLabel =
    flashSale.promotionBadgeLabel ??
    (isSept1Promo ? "−67%" : "−50%")

  useEffect(() => {
    if (!flashSaleActive && !flashSale.active) return

    const timerId = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [flashSaleActive, flashSale.active, data.settings.paywallPromotionId])

  useEffect(() => {
    if (isSept1Promo) return
    if (!flashSale.active || !data.settings.paywallFlashSaleStartedAt || !user?.id) return

    const userKey = getClientUserKey(user.id)
    const startedAt = data.settings.paywallFlashSaleStartedAt
    const remindAtMs =
      new Date(startedAt).getTime() + FLASH_SALE_REMINDER_DELAY_MS

    const tick = () => {
      if (Date.now() >= remindAtMs - 60_000) {
        triggerFlashSaleReminderCheck(userKey, startedAt)
      }
    }

    tick()
    const intervalId = window.setInterval(tick, 15_000)
    return () => window.clearInterval(intervalId)
  }, [flashSale.active, data.settings.paywallFlashSaleStartedAt, user?.id])

  useEffect(() => {
    if (!user?.id) return

    const userKey = getClientUserKey(user.id)

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      void refreshSubscriptionAfterExternalPayment(userKey).then((active) => {
        if (active) onClose()
      })
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [onClose, refreshSubscriptionAfterExternalPayment, user?.id])

  async function handlePay() {
    if (!agreedToTerms) return
    if (!user?.id) {
      setError("Не удалось определить Telegram-профиль. Перезапустите мини-приложение и попробуйте снова.")
      return
    }

    setError(null)
    setPaying(true)

    try {
      const orderId = crypto.randomUUID()
      const userKey = getClientUserKey(user.id)

      const response = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          userKey,
          orderId,
          paywallFlashSaleStartedAt: data.settings.paywallFlashSaleStartedAt,
          flashSaleDurationMs: data.settings.flashSaleDurationMs,
          paywallPromotionId: data.settings.paywallPromotionId,
        }),
      })

      const payload = await response.json()
      if (!response.ok) {
        setError(
          payload.error === "YOOKASSA_NOT_CONFIGURED"
            ? "ЮKassa не настроена на сервере. Добавьте YOOKASSA_SHOP_ID и YOOKASSA_SECRET_KEY в Vercel → Settings → Environment Variables и пересоберите проект."
            : payload.message ||
              "Оплата временно недоступна. Проверьте настройки ЮKassa на сервере.",
        )
        return
      }

      localStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, payload.paymentId)
      if (payload.orderId) {
        localStorage.setItem(PENDING_ORDER_ID_KEY, payload.orderId)
      }
      openLink(payload.confirmationUrl)
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

  const { yearly, monthly } = pricing
  const yearlyTotalLabel = yearly.total ? formatRub(yearly.total) : null
  const yearlyListTotalLabel = yearly.listTotal ? formatRub(yearly.listTotal) : null

  return (
    <div className="absolute inset-0 z-[80] flex flex-col bg-background">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(0.25rem,env(safe-area-inset-top))]">
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

        {flashSaleActive && flashSale.active ? (
          <FlashSaleBanner
            countdownLabel={flashSale.countdownLabel}
            title={flashSale.promotionTitle}
            badgeLabel={discountBadgeLabel}
            showForeverBadge={!isSept1Promo}
            subtitle={
              isSept1Promo
                ? "Годовая подписка всего 999 ₽ вместо 2980 ₽ — только сегодня"
                : undefined
            }
          />
        ) : null}

        <h2 className="shrink-0 text-center font-serif text-[1.35rem] font-bold leading-tight text-foreground">
          {flashSaleActive
            ? isSept1Promo
              ? "Суперскидка на год"
              : "Твоя цена со скидкой"
            : "Выбери свой план"}
        </h2>

        <div className="mt-2 flex shrink-0 justify-center gap-0.5" aria-label="5 из 5 звёзд">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-4 fill-amber-400 text-amber-400" strokeWidth={0} />
          ))}
        </div>

        <div className="mx-auto mt-3 flex w-full max-w-[21rem] shrink-0 flex-col">
          {PAYWALL_TESTIMONIALS.map((review, index) => (
            <article
              key={review.author}
              className={`rounded-block-sm border border-border/70 bg-card px-3.5 py-2.5 shadow-md shadow-primary/10 ${TESTIMONIAL_LAYOUT[index].className}`}
            >
              <p className="text-[13px] leading-snug text-foreground">«{review.text}»</p>
              <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                — {review.author}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2.5">
          <div className="relative shrink-0 pt-3">
            <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
              {flashSaleActive && yearly.showDiscount ? (
                <PlanDiscountBadge
                  label={discountBadgeLabel}
                  className="rounded-full px-3.5 py-1 text-xs shadow-xl ring-2 ring-background"
                />
              ) : (
                <span className="rounded-md bg-primary px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground shadow-sm">
                  Самый выгодный
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPlan("yearly")}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3.5 pt-5 text-left transition-all ${
                plan === "yearly"
                  ? "border-2 border-primary bg-primary/10 shadow-sm shadow-primary/10"
                  : "border border-border bg-card shadow-sm shadow-primary/5"
              }`}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif text-[15px] font-bold text-foreground">Годовая</p>
                  {flashSaleActive ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      цена навсегда
                    </span>
                  ) : null}
                </div>
                {flashSaleActive && yearlyListTotalLabel && yearlyTotalLabel ? (
                  <div className="mt-0.5 text-xs font-medium">
                    <span className="text-muted-foreground line-through">
                      12 мес · {yearlyListTotalLabel}
                    </span>
                    <span className="ml-2 font-bold text-primary">12 мес · {yearlyTotalLabel}</span>
                  </div>
                ) : yearlyTotalLabel ? (
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                    12 мес · {yearlyTotalLabel}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <PlanPrice prices={yearly} />
                <PlanRadio selected={plan === "yearly"} />
              </div>
            </button>
          </div>

          <div className="relative shrink-0">
            {flashSaleActive && monthly.showDiscount ? (
              <div className="absolute right-4 top-0 z-10 -translate-y-1/2">
                <PlanDiscountBadge
                  label={discountBadgeLabel}
                  className="rounded-full px-2.5 py-1 text-[10px] shadow-lg ring-2 ring-background"
                />
              </div>
            ) : null}
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
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-serif text-[15px] font-bold text-foreground">Месячная</p>
                  {flashSaleActive ? (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                      цена навсегда
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2.5">
                <PlanPrice prices={monthly} />
                <PlanRadio selected={plan === "monthly"} />
              </div>
            </button>
          </div>

          <p className="rounded-block-sm bg-secondary/60 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            {getPaywallPaymentNote(data.settings.currency)}
          </p>

          <label className="flex items-start justify-between gap-3 rounded-block-sm border border-border/70 bg-card px-3 py-3">
            <span className="min-w-0 flex-1 text-[11px] leading-relaxed text-muted-foreground">
              Нажимая «Оплатить», вы соглашаетесь с{" "}
              <Link href="/terms" className="font-semibold text-primary underline-offset-2 hover:underline">
                Условиями использования
              </Link>{" "}
              и{" "}
              <Link href="/privacy" className="font-semibold text-primary underline-offset-2 hover:underline">
                Политикой конфиденциальности
              </Link>
            </span>
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 size-6 shrink-0 accent-primary"
              aria-label="Согласие с условиями использования и политикой конфиденциальности"
            />
          </label>

          <button
            type="button"
            onClick={handlePay}
            disabled={paying || !agreedToTerms}
            className={`w-full rounded-full py-[1.125rem] text-base font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-40 ${
              flashSaleActive
                ? "bg-destructive shadow-lg shadow-destructive/35"
                : "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
            }`}
          >
            {paying
              ? "Создаём платёж…"
              : flashSaleActive
                ? "Зафиксировать скидку −50%"
                : "Оплатить"}
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

          <div className="pb-2">
            <SupportSection compact />
          </div>
        </div>
      </div>
    </div>
  )
}

export type { SubscriptionPlan }
