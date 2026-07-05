import { NextResponse } from "next/server"
import { PLAN_CONFIG, type SubscriptionPlan } from "@/lib/subscription"
import {
  createYooKassaPayment,
  getAppBaseUrl,
  isYooKassaConfigured,
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
    }

    if (body.plan !== "yearly" && body.plan !== "monthly") {
      return NextResponse.json({ error: "INVALID_PLAN" }, { status: 400 })
    }

    if (!body.userKey?.trim() || !body.orderId?.trim()) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 })
    }

    const plan = PLAN_CONFIG[body.plan]
    const returnUrl = `${getAppBaseUrl()}/payment/success`

    const payment = await createYooKassaPayment({
      plan: body.plan,
      userKey: body.userKey.trim(),
      orderId: body.orderId.trim(),
      returnUrl,
      amount: plan.amount,
      description: plan.description,
    })

    const confirmationUrl = payment.confirmation?.confirmation_url
    if (!confirmationUrl) {
      return NextResponse.json({ error: "NO_CONFIRMATION_URL" }, { status: 502 })
    }

    return NextResponse.json({
      paymentId: payment.id,
      confirmationUrl,
    })
  } catch (error) {
    console.error("[payments/create]", error)
    return NextResponse.json({ error: "PAYMENT_CREATE_FAILED" }, { status: 500 })
  }
}
