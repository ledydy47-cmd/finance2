"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ThemeApplier } from "@/components/theme/theme-applier"
import { TelegramProvider } from "@/components/telegram/telegram-provider"
import { FinanceProvider, useFinance } from "@/context/finance-context"
import { PENDING_PAYMENT_STORAGE_KEY } from "@/lib/subscription"

function PaymentSuccessContent() {
  const router = useRouter()
  const { activateSubscription } = useFinance()
  const [message, setMessage] = useState("Проверяем оплату…")

  useEffect(() => {
    let cancelled = false

    async function verify() {
      const paymentId = localStorage.getItem(PENDING_PAYMENT_STORAGE_KEY)
      if (!paymentId) {
        setMessage("Не найден платёж. Вернитесь в приложение и попробуйте снова.")
        return
      }

      try {
        const response = await fetch(
          `/api/payments/verify?paymentId=${encodeURIComponent(paymentId)}`,
        )
        const data = await response.json()

        if (!response.ok || !data.active) {
          setMessage("Оплата ещё не подтверждена. Подождите минуту и откройте приложение снова.")
          return
        }

        activateSubscription({
          plan: data.plan,
          paymentId: data.paymentId,
          expiresAt: data.expiresAt,
        })
        localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)

        if (!cancelled) {
          setMessage("Подписка активирована! Перенаправляем…")
          window.setTimeout(() => router.replace("/"), 1200)
        }
      } catch {
        if (!cancelled) {
          setMessage("Не удалось проверить оплату. Откройте приложение и нажмите «Восстановить покупки».")
        }
      }
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [activateSubscription, router])

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-block bg-card p-6 text-center shadow-sm shadow-primary/10">
        <p className="font-serif text-xl font-bold text-foreground">Оплата</p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={() => router.replace("/")}
          className="mt-6 w-full rounded-block-sm bg-primary py-3 text-sm font-bold text-primary-foreground"
        >
          В приложение
        </button>
      </div>
    </div>
  )
}

export default function PaymentSuccessPage() {
  return (
    <TelegramProvider>
      <FinanceProvider>
        <ThemeApplier />
        <PaymentSuccessContent />
      </FinanceProvider>
    </TelegramProvider>
  )
}
