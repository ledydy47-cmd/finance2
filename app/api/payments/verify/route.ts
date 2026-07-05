import { NextResponse } from "next/server"
import { verifyPaymentById } from "@/lib/server/subscription-service"

export async function GET(request: Request) {
  const paymentId = new URL(request.url).searchParams.get("paymentId")?.trim()
  if (!paymentId) {
    return NextResponse.json({ error: "MISSING_PAYMENT_ID" }, { status: 400 })
  }

  try {
    const subscription = await verifyPaymentById(paymentId)
    if (!subscription) {
      return NextResponse.json({ active: false }, { status: 404 })
    }

    return NextResponse.json({
      paymentId: subscription.paymentId,
      plan: subscription.plan,
      expiresAt: subscription.currentPeriodEnd,
      active: true,
      autoRenew: subscription.autoRenew,
      status: subscription.status,
    })
  } catch (error) {
    console.error("[payments/verify]", error)
    return NextResponse.json({ error: "VERIFY_FAILED" }, { status: 500 })
  }
}
