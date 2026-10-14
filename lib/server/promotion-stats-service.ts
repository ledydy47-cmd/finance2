import {
  listTrackedFlashSaleLifecycles,
  type FlashSaleLifecycle,
} from "@/lib/server/flash-sale-lifecycle-store"
import { readAnalyticsStore } from "@/lib/server/user-analytics-store"
import type { UserAnalyticsRecord } from "@/lib/server/user-analytics-types"

function isPromotionRecipient(lifecycle: FlashSaleLifecycle, promotionId: string) {
  return (
    lifecycle.broadcastPromotionId === promotionId ||
    lifecycle.pendingPromotionId === promotionId ||
    lifecycle.promotionId === promotionId
  )
}

function openedAppAfterBroadcast(
  lifecycle: FlashSaleLifecycle,
  user: UserAnalyticsRecord | undefined,
) {
  if (lifecycle.promoOpenedAt) return true

  const sentAt = lifecycle.offer4hSentAt
  if (!sentAt) return false

  if (
    lifecycle.promotionId &&
    lifecycle.startedAt &&
    new Date(lifecycle.startedAt).getTime() >= new Date(sentAt).getTime()
  ) {
    return true
  }

  if (user?.lastVisitAt && user.lastVisitAt > sentAt) return true

  return user?.events.some(
    (event) => event.type === "app_opened" && event.at > sentAt,
  )
}

function hasEventAfter(
  user: UserAnalyticsRecord | undefined,
  sentAt: string | null,
  type: UserAnalyticsRecord["events"][number]["type"],
) {
  if (!user || !sentAt) return false
  return user.events.some((event) => event.type === type && event.at > sentAt)
}

function subscribedYearlyAfter(user: UserAnalyticsRecord | undefined, sentAt: string | null) {
  if (!user || !sentAt) return false
  if (user.subscribedYearlyAt && user.subscribedYearlyAt > sentAt) return true
  return hasEventAfter(user, sentAt, "subscription_paid_yearly")
}

export async function getPromotionBroadcastStats(promotionId: string) {
  const [lifecycles, analyticsStore] = await Promise.all([
    listTrackedFlashSaleLifecycles(),
    readAnalyticsStore(),
  ])

  const recipients = lifecycles.filter((lc) => isPromotionRecipient(lc, promotionId))
  let openedApp = 0
  let paywallShown = 0
  let subscribedYearly = 0

  for (const lifecycle of recipients) {
    const user = analyticsStore.users[lifecycle.userKey]
    const sentAt = lifecycle.offer4hSentAt

    if (openedAppAfterBroadcast(lifecycle, user)) openedApp += 1
    if (hasEventAfter(user, sentAt, "paywall_shown")) paywallShown += 1
    if (subscribedYearlyAfter(user, sentAt)) subscribedYearly += 1
  }

  const pendingOpen = recipients.filter(
    (lc) => lc.pendingPromotionId === promotionId && !lc.promoOpenedAt,
  ).length

  return {
    promotionId,
    messagesSent: recipients.length,
    openedApp,
    pendingOpen,
    paywallShown,
    subscribedYearly,
    openRate:
      recipients.length > 0 ? Math.round((openedApp / recipients.length) * 1000) / 10 : 0,
    updatedAt: new Date().toISOString(),
  }
}
