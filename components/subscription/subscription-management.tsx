"use client"

import { useState } from "react"
import { useTelegram } from "@/components/telegram/telegram-provider"
import { useFinance } from "@/context/finance-context"
import { getClientUserKey } from "@/lib/client-id"
import { PLAN_CONFIG } from "@/lib/subscription"

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function SubscriptionManagement() {
  const { data, updateSettings, syncSubscriptionFromServer } = useFinance()
  const { user } = useTelegram()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const settings = data.settings
  const planLabel = settings.subscriptionPlan
    ? PLAN_CONFIG[settings.subscriptionPlan].label
    : "Подписка"

  async function handleCancelRenewal() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/subscription/cancel-renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey: getClientUserKey(user?.id) }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError("Не удалось отключить автопродление")
        return
      }
      updateSettings({
        autoRenew: false,
        subscriptionStatus: "canceled",
        subscriptionExpiresAt: payload.currentPeriodEnd,
      })
      setConfirmCancel(false)
      await syncSubscriptionFromServer(getClientUserKey(user?.id))
    } catch {
      setError("Не удалось отключить автопродление")
    } finally {
      setLoading(false)
    }
  }

  async function handleResumeRenewal() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/subscription/resume-renewal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userKey: getClientUserKey(user?.id) }),
      })
      const payload = await response.json()
      if (!response.ok) {
        setError(
          payload.error === "NO_PAYMENT_METHOD"
            ? "Нет сохранённого способа оплаты. Оформите подписку заново."
            : "Не удалось включить автопродление",
        )
        return
      }
      updateSettings({
        autoRenew: true,
        subscriptionStatus: "active",
        subscriptionExpiresAt: payload.currentPeriodEnd,
      })
      await syncSubscriptionFromServer(getClientUserKey(user?.id))
    } catch {
      setError("Не удалось включить автопродление")
    } finally {
      setLoading(false)
    }
  }

  if (!settings.isSubscribed && !settings.subscriptionExpiresAt) return null

  return (
    <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
      <div className="text-sm text-muted-foreground">
        <p>
          <span className="font-semibold text-foreground">Тариф:</span> {planLabel}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-foreground">Доступ до:</span>{" "}
          {formatDate(settings.subscriptionExpiresAt)}
        </p>
        <p className="mt-1">
          <span className="font-semibold text-foreground">Автопродление:</span>{" "}
          {settings.autoRenew === false ? "выключено" : "включено"}
        </p>
      </div>

      {settings.autoRenew === false ? (
        <button
          type="button"
          disabled={loading}
          onClick={handleResumeRenewal}
          className="w-full rounded-block-sm border border-primary/25 bg-primary/10 py-3 text-sm font-bold text-primary disabled:opacity-50"
        >
          Включить автопродление
        </button>
      ) : (
        <button
          type="button"
          disabled={loading}
          onClick={() => setConfirmCancel(true)}
          className="w-full rounded-block-sm border border-destructive/20 bg-destructive/5 py-3 text-sm font-bold text-destructive disabled:opacity-50"
        >
          Отменить автопродление
        </button>
      )}

      {confirmCancel && (
        <div className="rounded-block-sm border border-border bg-background p-3">
          <p className="text-sm leading-relaxed text-foreground">
            Автопродление будет отключено. Доступ сохранится до{" "}
            {formatDate(settings.subscriptionExpiresAt)}, после чего подписка перейдёт на
            бесплатный тариф.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleCancelRenewal}
              className="flex-1 rounded-block-sm bg-destructive py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              Подтвердить
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              className="rounded-block-sm bg-secondary px-4 py-2.5 text-sm font-semibold"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
