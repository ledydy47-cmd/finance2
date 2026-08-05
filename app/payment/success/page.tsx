"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ThemeApplier } from "@/components/theme/theme-applier"
import { TelegramProvider, useTelegram } from "@/components/telegram/telegram-provider"
import { FinanceProvider, useFinance } from "@/context/finance-context"
import { verifyPaymentByOrderWithRetry } from "@/lib/pending-payment-verify"
import { PENDING_ORDER_ID_KEY, PENDING_PAYMENT_STORAGE_KEY } from "@/lib/subscription"
import { getClientUserKey } from "@/lib/client-id"

function PaymentSuccessContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    confirmPendingPayment,
    syncSubscriptionFromServer,
    activateSubscription,
    refreshSubscriptionAfterExternalPayment,
  } = useFinance()
  const { user } = useTelegram()
  const [message, setMessage] = useState("Проверяем оплату…")

  useEffect(() => {
    let cancelled = false

    async function verify() {
      const userKey = getClientUserKey(user?.id)
      const orderId =
        searchParams.get("orderId")?.trim() ||
        localStorage.getItem(PENDING_ORDER_ID_KEY)?.trim()

      if (orderId) {
        localStorage.setItem(PENDING_ORDER_ID_KEY, orderId)
        const verified = await verifyPaymentByOrderWithRetry(orderId)
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
          localStorage.removeItem(PENDING_ORDER_ID_KEY)
          setMessage("Подписка активирована! Вернитесь в Telegram и откройте приложение.")
          return
        }
      }

      if (await refreshSubscriptionAfterExternalPayment(userKey)) {
        if (cancelled) return
        setMessage("Подписка активирована! Вернитесь в Telegram и откройте приложение.")
        return
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
  }, [
    activateSubscription,
    confirmPendingPayment,
    refreshSubscriptionAfterExternalPayment,
    searchParams,
    syncSubscriptionFromServer,
    user?.id,
  ])

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
