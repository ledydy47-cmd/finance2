import { NextResponse } from "next/server"
import { isYooKassaConfigured, fetchYooKassaPayment } from "@/lib/yookassa/server"
import { mapPaymentToSubscription } from "@/lib/yookassa/verify"

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

    if (body.event !== "payment.succeeded" || !body.object?.id) {
      return NextResponse.json({ ok: true })
    }

    const payment = await fetchYooKassaPayment(body.object.id)
    const subscription = mapPaymentToSubscription(payment)
    if (!subscription) {
      return NextResponse.json({ ok: true })
    }

    console.info("[payments/webhook] subscription activated", {
      paymentId: subscription.paymentId,
      plan: subscription.plan,
      userKey: payment.metadata?.userKey,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[payments/webhook]", error)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
