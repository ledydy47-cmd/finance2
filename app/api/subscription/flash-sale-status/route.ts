import { NextResponse } from "next/server"
import { getFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import { getFlashSaleStartedAt } from "@/lib/server/flash-sale-store"
import { getFlashSaleTiming } from "@/lib/server/flash-sale-timing"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import {
  getPaywallPromotion,
  getPromotionRemainingMs,
  isPromotionActive,
} from "@/lib/paywall-promotions"

export async function GET(request: Request) {
  try {
    const userKey = new URL(request.url).searchParams.get("userKey")?.trim()
    if (!userKey) {
      return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
    }

    const subscription = await getServerSubscriptionStatus(userKey)
    const lifecycle = await getFlashSaleLifecycle(userKey)
    const pendingOffer = lifecycle?.pendingOffer ?? null
    const pendingPromotionId = lifecycle?.pendingPromotionId ?? null
    const promotionId = lifecycle?.promotionId ?? pendingPromotionId
    const promotion = getPaywallPromotion(promotionId)

    if (subscription?.active) {
      return NextResponse.json({
        active: false,
        subscribed: true,
        pendingOffer: null,
        pendingPromotionId: null,
      })
    }

    if (promotion && isPromotionActive(promotion) && lifecycle?.promotionId) {
      const remainingMs = getPromotionRemainingMs(promotion)
      const startedAt = (await getFlashSaleStartedAt(userKey)) ?? lifecycle.startedAt
      return NextResponse.json({
        active: remainingMs > 0,
        expired: remainingMs <= 0,
        startedAt,
        saleDurationMs: remainingMs,
        remainingMs,
        pendingOffer: null,
        promotionId: promotion.id,
        promotionEndsAt: promotion.endsAt,
      })
    }

    const startedAt = await getFlashSaleStartedAt(userKey)
    if (!startedAt) {
      return NextResponse.json({
        active: false,
        pendingOffer,
        pendingPromotionId,
      })
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
        pendingPromotionId,
      })
    }

    return NextResponse.json({
      active: true,
      startedAt,
      saleDurationMs: timing.saleDurationMs,
      remainingMs,
      pendingOffer: null,
      pendingPromotionId: null,
      promotionId: lifecycle?.promotionId ?? null,
    })
  } catch (error) {
    console.error("[subscription/flash-sale-status]", error)
    return NextResponse.json({ error: "STATUS_FAILED" }, { status: 500 })
  }
}
