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
import { sendMessageToUser } from "@/lib/server/user-analytics-service"

export const DEFAULT_REOFFER_BROADCAST_MESSAGE = FLASH_SALE_OFFER_4H_MESSAGE

export type ReofferBroadcastAudience = "paywall_non_subscribers" | "all_non_subscribers"

export async function broadcastReofferToPaywallNonSubscribers(input?: {
  message?: string
  offerType?: "4h" | "24h"
  audience?: ReofferBroadcastAudience
  offset?: number
  limit?: number
}) {
  const message = input?.message?.trim() || DEFAULT_REOFFER_BROADCAST_MESSAGE
  const offerType = input?.offerType ?? "4h"
  const audience = input?.audience ?? "paywall_non_subscribers"
  const offset = Math.max(0, input?.offset ?? 0)
  const limit = input?.limit && input.limit > 0 ? Math.floor(input.limit) : null
  const store = await readAnalyticsStore()
  const allCandidates = Object.values(store.users).filter((user) => {
    if (user.subscriptionPlan !== "none") return false
    if (audience === "all_non_subscribers") return true
    return Boolean(user.paywallShownAt)
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

    lifecycle.pendingOffer = offerType
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
    results,
  }
}
