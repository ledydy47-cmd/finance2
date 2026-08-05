import { NextResponse } from "next/server"
import { isUserKeyBlocked } from "@/lib/server/blocked-users-service"
import { savePendingPayment } from "@/lib/server/pending-payment-store"
import { resolveServerPaywallPricing } from "@/lib/server/paywall-pricing-service"
import { PLAN_CONFIG, type SubscriptionPlan } from "@/lib/subscription"
import {
  createYooKassaPayment,
  getAppBaseUrl,
  isYooKassaConfigured,
  parseYooKassaErrorMessage,
} from "@/lib/yookassa/server"

export async function POST(request: Request) {
  if (!isYooKassaConfigured()) {
    return NextResponse.json(
      { error: "YOOKASSA_NOT_CONFIGURED", message: "ЮKassa не настроена на сервере" },
      { status: 503 },
    )
  }

  try {
    const body = (await request.json()) as {
      plan?: SubscriptionPlan
      userKey?: string
      orderId?: string
      paywallFlashSaleStartedAt?: string | null
      flashSaleDurationMs?: number | null
    }

    if (body.plan !== "yearly" && body.plan !== "monthly") {
      return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 })
    }

    if (!body.userKey?.trim() || !body.orderId?.trim()) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 })
    }

    const userKey = body.userKey.trim()
    if (await isUserKeyBlocked(userKey)) {
      return NextResponse.json({ error: "USER_BLOCKED" }, { status: 403 })
    }

    const planConfig = PLAN_CONFIG[body.plan]
    const orderId = body.orderId.trim()

    if (!userKey.startsWith("tg-")) {
      return NextResponse.json(
        {
          error: "MISSING_TELEGRAM_USER",
          message: "Не удалось определить Telegram-профиль. Перезапустите мини-приложение и попробуйте снова.",
        },
        { status: 400 },
      )
    }

    const pricing = await resolveServerPaywallPricing({
      userKey,
      plan: body.plan,
      paywallFlashSaleStartedAt: body.paywallFlashSaleStartedAt,
      flashSaleDurationMs: body.flashSaleDurationMs,
    })
    const returnUrl = `${getAppBaseUrl()}/payment/success?orderId=${encodeURIComponent(orderId)}`

    const payment = await createYooKassaPayment({
      plan: body.plan,
      userKey,
      orderId,
      returnUrl,
      amount: pricing.amount,
      description: planConfig.description,
    })

    await savePendingPayment({
      paymentId: payment.id,
      userKey,
      plan: body.plan,
      orderId,
      createdAt: new Date().toISOString(),
    })

    const confirmationUrl = payment.confirmation?.confirmation_url
    if (!confirmationUrl) {
      return NextResponse.json({ error: "NO_CONFIRMATION_URL" }, { status: 502 })
    }

    return NextResponse.json({
      paymentId: payment.id,
      orderId,
      confirmationUrl,
    })
  } catch (error) {
    console.error("[payments/create]", error)
    const yookassaMessage = parseYooKassaErrorMessage(error)
    return NextResponse.json(
      {
        error: "PAYMENT_CREATE_FAILED",
        message:
          yookassaMessage ||
          "Не удалось создать платёж. Попробуйте ещё раз или напишите в поддержку.",
      },
      { status: 500 },
    )
  }
}
