"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ThemeApplier } from "@/components/theme/theme-applier"
import { TelegramProvider, useTelegram } from "@/components/telegram/telegram-provider"
import { FinanceProvider, useFinance } from "@/context/finance-context"
import { PENDING_PAYMENT_STORAGE_KEY } from "@/lib/subscription"
import { getClientUserKey } from "@/lib/client-id"

async function verifyPaymentWithRetryByOrder(orderId: string) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    try {
      const response = await fetch(
        `/api/payments/verify-by-order?orderId=${encodeURIComponent(orderId)}`,
      )
      const data = (await response.json()) as {
        active?: boolean
        paymentId?: string
        plan?: "yearly" | "monthly"
        expiresAt?: string
        autoRenew?: boolean
        status?: string
      }
      if (response.ok && data.active && data.paymentId && data.plan && data.expiresAt) {
        return data
      }
    } catch {
      // retry
    }

    if (attempt < 14) {
      await new Promise((resolve) => window.setTimeout(resolve, 2000))
    }
  }

  return null
}

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { confirmPendingPayment, syncSubscriptionFromServer, activateSubscription } = useFinance()
  const { user } = useTelegram()
  const [message, setMessage] = useState("Проверяем оплату…")

  useEffect(() => {
    let cancelled = false

    async function verify() {
      const userKey = getClientUserKey(user?.id)
      const orderId = searchParams.get("orderId")?.trim()

      if (orderId) {
        const verified = await verifyPaymentWithRetryByOrder(orderId)
        if (cancelled) return

        if (verified) {
          activateSubscription({
            plan: verified.plan,
            paymentId: verified.paymentId,
            expiresAt: verified.expiresAt,
            autoRenew: verified.autoRenew ?? true,
            subscriptionStatus:
              (verified.status as "active" | "canceled" | "past_due" | "expired") ?? "active",
          })
          localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY)
          setMessage("Подписка активирована! Вернитесь в Telegram и откройте приложение.")
          return
        }
      }

      const synced = await syncSubscriptionFromServer(userKey)
      if (cancelled) return

      if (synced) {
        setMessage("Подписка активирована! Вернитесь в Telegram и откройте приложение.")
        return
      }

      const paymentId =
        searchParams.get("paymentId")?.trim() ||
        localStorage.getItem(PENDING_PAYMENT_STORAGE_KEY)

      if (paymentId) {
        localStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, paymentId)
        const activated = await confirmPendingPayment()
        if (cancelled) return

        if (activated) {
          setMessage("Подписка активирована! Вернитесь в Telegram и откройте приложение.")
          return
        }
      }

      setMessage(
        "Оплата ещё подтверждается. Вернитесь в Telegram, полностью закройте и снова откройте приложение.",
      )
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [activateSubscription, confirmPendingPayment, searchParams, syncSubscriptionFromServer, user?.id])

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
        <Suspense
          fallback={
            <div className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
              <p className="text-sm text-muted-foreground">Проверяем оплату…</p>
            </div>
          }
        >
          <PaymentSuccessContent />
        </Suspense>
      </FinanceProvider>
    </TelegramProvider>
  )
}
