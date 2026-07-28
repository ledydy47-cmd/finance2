import { NextResponse } from "next/server"
import { getFlashSaleStartedAt } from "@/lib/server/flash-sale-store"
import { getFlashSaleTiming } from "@/lib/server/flash-sale-timing"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"

export async function GET(request: Request) {
  try {
    const userKey = new URL(request.url).searchParams.get("userKey")?.trim()
    if (!userKey) {
      return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
    }

    const subscription = await getServerSubscriptionStatus(userKey)
    if (subscription?.active) {
      return NextResponse.json({ active: false, subscribed: true })
    }

    const startedAt = await getFlashSaleStartedAt(userKey)
    if (!startedAt) {
      return NextResponse.json({ active: false })
    }

    const timing = await getFlashSaleTiming(userKey, startedAt)
    const startedMs = new Date(startedAt).getTime()
    const remainingMs = timing.saleDurationMs - (Date.now() - startedMs)

    if (Number.isNaN(startedMs) || remainingMs <= 0) {
      return NextResponse.json({
        active: false,
        expired: true,
        startedAt,
        saleDurationMs: timing.saleDurationMs,
      })
    }

    return NextResponse.json({
      active: true,
      startedAt,
      saleDurationMs: timing.saleDurationMs,
      remainingMs,
    })
  } catch (error) {
    console.error("[subscription/flash-sale-status]", error)
    return NextResponse.json({ error: "STATUS_FAILED" }, { status: 500 })
  }
}
