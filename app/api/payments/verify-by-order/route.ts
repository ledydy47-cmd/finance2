import { NextResponse } from "next/server"
import { verifyPaymentByOrderId } from "@/lib/server/subscription-service"

export async function GET(request: Request) {
  const orderId = new URL(request.url).searchParams.get("orderId")?.trim()
  if (!orderId) {
    return NextResponse.json({ error: "MISSING_ORDER_ID" }, { status: 400 })
  }

  try {
    const subscription = await verifyPaymentByOrderId(orderId)
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
    console.error("[payments/verify-by-order]", error)
    return NextResponse.json({ error: "VERIFY_FAILED" }, { status: 500 })
  }
}
