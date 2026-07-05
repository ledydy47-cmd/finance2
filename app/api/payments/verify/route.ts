import { NextResponse } from "next/server"
import { isYooKassaConfigured } from "@/lib/yookassa/server"
import { verifyYooKassaSubscription } from "@/lib/yookassa/verify"

export async function GET(request: Request) {
  if (!isYooKassaConfigured()) {
    return NextResponse.json(
      { error: "YOOKASSA_NOT_CONFIGURED", message: "ЮKassa не настроена на сервере" },
      { status: 503 },
    )
  }

  const paymentId = new URL(request.url).searchParams.get("paymentId")?.trim()
  if (!paymentId) {
    return NextResponse.json({ error: "MISSING_PAYMENT_ID" }, { status: 400 })
  }

  try {
    const subscription = await verifyYooKassaSubscription(paymentId)
    if (!subscription?.active) {
      return NextResponse.json({ error: "PAYMENT_NOT_SUCCEEDED", active: false }, { status: 402 })
    }

    return NextResponse.json(subscription)
  } catch (error) {
    console.error("[payments/verify]", error)
    return NextResponse.json({ error: "VERIFY_FAILED" }, { status: 500 })
  }
}
