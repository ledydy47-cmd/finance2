import { NextResponse } from "next/server"
import { isYooKassaConfigured, fetchYooKassaPayment } from "@/lib/yookassa/server"
import { activateSubscriptionFromPayment } from "@/lib/server/subscription-service"

export async function POST(request: Request) {
  if (!isYooKassaConfigured()) {
    return NextResponse.json({ ok: false }, { status: 503 })
  }

  try {
    const body = (await request.json()) as {
      type?: string
      event?: string
      object?: { id?: string }
    }

    const paymentId = body.object?.id
    if (!paymentId) {
      return NextResponse.json({ ok: true })
    }

    const payment = await fetchYooKassaPayment(paymentId)

    if (body.event === "payment.succeeded") {
      const subscription = await activateSubscriptionFromPayment(payment)
      console.info("[payments/webhook] subscription updated", subscription)
    }

    if (body.event === "payment.canceled") {
      console.info("[payments/webhook] payment canceled", paymentId)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[payments/webhook]", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
