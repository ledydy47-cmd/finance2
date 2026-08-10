import { NextResponse } from "next/server"
import { getFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
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
    const lifecycle = await getFlashSaleLifecycle(userKey)
    const pendingOffer = lifecycle?.pendingOffer ?? null

    if (subscription?.active) {
      return NextResponse.json({ active: false, subscribed: true, pendingOffer: null })
    }

    const startedAt = await getFlashSaleStartedAt(userKey)
    if (!startedAt) {
      return NextResponse.json({ active: false, pendingOffer })
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
        pendingOffer,
      })
    }

    return NextResponse.json({
      active: true,
      startedAt,
      saleDurationMs: timing.saleDurationMs,
      remainingMs,
      pendingOffer: null,
    })
  } catch (error) {
    console.error("[subscription/flash-sale-status]", error)
    return NextResponse.json({ error: "STATUS_FAILED" }, { status: 500 })
  }
}
