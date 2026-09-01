import {
  FLASH_SALE_OFFER_4H_MESSAGE,
} from "@/lib/server/flash-sale-cron-service"
import {
  getFlashSaleLifecycle,
  registerFlashSaleLifecycle,
  saveFlashSaleLifecycle,
} from "@/lib/server/flash-sale-lifecycle-store"
import { getFlashSaleStartedAt } from "@/lib/server/flash-sale-store"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import { readAnalyticsStore } from "@/lib/server/user-analytics-store"
import {
  formatDateInAnalyticsTimezone,
  sendMessageToUser,
} from "@/lib/server/user-analytics-service"
import {
  getPaywallPromotion,
  isPromotionActive,
  SEPT1_BROADCAST_MESSAGE,
} from "@/lib/paywall-promotions"

export const DEFAULT_REOFFER_BROADCAST_MESSAGE = FLASH_SALE_OFFER_4H_MESSAGE

export type ReofferBroadcastAudience = "paywall_non_subscribers" | "all_non_subscribers"

export async function broadcastReofferToPaywallNonSubscribers(input?: {
  message?: string
  offerType?: "4h" | "24h"
  audience?: ReofferBroadcastAudience
  paywallDateYmd?: string
  promotionId?: string
  offset?: number
  limit?: number
}) {
  const promotion = getPaywallPromotion(input?.promotionId)
  const defaultMessage =
    input?.promotionId === "sept1_2026" ? SEPT1_BROADCAST_MESSAGE : DEFAULT_REOFFER_BROADCAST_MESSAGE
  const message = input?.message?.trim() || defaultMessage
  const offerType = input?.offerType ?? "4h"
  const audience = input?.audience ?? "paywall_non_subscribers"
  const paywallDateYmd = input?.paywallDateYmd?.trim()
  const promotionId = input?.promotionId?.trim() || null
  const offset = Math.max(0, input?.offset ?? 0)
  const limit = input?.limit && input.limit > 0 ? Math.floor(input.limit) : null

  if (promotionId && promotion && !isPromotionActive(promotion)) {
    return {
      total: 0,
      batchOffset: offset,
      batchLimit: limit,
      batchSize: 0,
      sent: 0,
      failed: 0,
      skipped: true as const,
      reason: "PROMOTION_EXPIRED" as const,
      results: [],
    }
  }

  const store = await readAnalyticsStore()
  const allCandidates = Object.values(store.users).filter((user) => {
    if (user.subscriptionPlan !== "none") return false
    if (audience === "all_non_subscribers") {
      if (!paywallDateYmd) return true
      return (
        Boolean(user.paywallShownAt) &&
        formatDateInAnalyticsTimezone(new Date(user.paywallShownAt)) === paywallDateYmd
      )
    }
    if (!user.paywallShownAt) return false
    if (paywallDateYmd) {
      return formatDateInAnalyticsTimezone(new Date(user.paywallShownAt)) === paywallDateYmd
    }
    return true
  })
  const candidates = limit
    ? allCandidates.slice(offset, offset + limit)
    : allCandidates.slice(offset)

  const results: Array<{
    userKey: string
    sent: boolean
    reason?: string
  }> = []

  for (const user of candidates) {
    const subscription = await getServerSubscriptionStatus(user.userKey)
    if (subscription?.active) {
      results.push({ userKey: user.userKey, sent: false, reason: "SUBSCRIBED" })
      continue
    }

    const startedAt =
      (await getFlashSaleStartedAt(user.userKey)) ?? user.paywallShownAt ?? new Date().toISOString()

    let lifecycle = await getFlashSaleLifecycle(user.userKey)
    if (!lifecycle) {
      lifecycle = await registerFlashSaleLifecycle(user.userKey, startedAt)
    }

    if (!lifecycle.expiredAt) {
      lifecycle.expiredAt = new Date().toISOString()
    }
    lifecycle.pendingOffer = offerType
    if (promotionId) {
      lifecycle.pendingPromotionId = promotionId
    }
    if (offerType === "4h") lifecycle.offer4hSentAt = new Date().toISOString()
    if (offerType === "24h") lifecycle.offer24hSentAt = new Date().toISOString()
    await saveFlashSaleLifecycle(lifecycle)

    const sendResult = await sendMessageToUser({
      userKey: user.userKey,
      message,
    })

    results.push({
      userKey: user.userKey,
      sent: sendResult.ok,
      reason: sendResult.ok ? undefined : sendResult.error,
    })
  }

  return {
    total: allCandidates.length,
    batchOffset: offset,
    batchLimit: limit,
    batchSize: candidates.length,
    sent: results.filter((item) => item.sent).length,
    failed: results.filter((item) => !item.sent).length,
    promotionId,
    results,
  }
}
