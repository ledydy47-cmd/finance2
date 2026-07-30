import { ONBOARDING_REOFFER_1H_MS } from "@/lib/paywall-experiment"
import {
  getFlashSaleLifecycle,
  registerFlashSaleLifecycle,
  saveFlashSaleLifecycle,
  type FlashSalePendingOffer,
} from "@/lib/server/flash-sale-lifecycle-store"
import { getFlashSaleStartedAt } from "@/lib/server/flash-sale-store"
import { scheduleOnboardingReoffer1hDelivery } from "@/lib/server/onboarding-reoffer-scheduler"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import {
  getUserAnalyticsRecord,
  readAnalyticsStore,
  updateUserAnalyticsRecord,
} from "@/lib/server/user-analytics-store"
import type { UserAnalyticsRecord } from "@/lib/server/user-analytics-types"
import { sendMessageToUser } from "@/lib/server/user-analytics-service"

export const ONBOARDING_REOFFER_1H_MESSAGE =
  "ты нажала «Начать» — значит, мечта уже близко 💗 мы снова открыли для тебя скидку −50%. Загляни в приложение, пока она доступна"

const RETRY_REASONS = new Set(["NOT_DUE", "NOT_SCHEDULED", "STALE"])

export function shouldRetryOnboardingReoffer1h(result: { sent: boolean; reason?: string }) {
  return !result.sent && result.reason != null && RETRY_REASONS.has(result.reason)
}

function getDueMs(scheduledAt: string) {
  return new Date(scheduledAt).getTime() + ONBOARDING_REOFFER_1H_MS
}

async function ensureLifecycleForPendingOffer(userKey: string, anchorStartedAt: string) {
  const flashStartedAt = (await getFlashSaleStartedAt(userKey)) ?? anchorStartedAt
  const lifecycle = await getFlashSaleLifecycle(userKey)
  if (lifecycle) return lifecycle
  return registerFlashSaleLifecycle(userKey, flashStartedAt)
}

export async function markOnboardingReoffer1hScheduled(userKey: string, scheduledAt: string) {
  await updateUserAnalyticsRecord(userKey, (existing) => {
    if (!existing) return existing
    if (existing.onboardingReoffer1hScheduledAt || existing.onboardingReoffer1hSentAt) {
      return existing
    }
    existing.onboardingReoffer1hScheduledAt = scheduledAt
    return existing
  })
}

export async function scheduleOnboardingReoffer1hIfNeeded(userKey: string, onboardingStartedAt: string) {
  const user = await getUserAnalyticsRecord(userKey)
  if (!user?.onboardingStartedAt) return { scheduled: false as const, reason: "NO_ONBOARDING" as const }
  if (user.onboardingReoffer1hScheduledAt || user.onboardingReoffer1hSentAt) {
    return { scheduled: false as const, reason: "ALREADY_HANDLED" as const }
  }

  const subscription = await getServerSubscriptionStatus(userKey)
  if (subscription?.active) {
    return { scheduled: false as const, reason: "SUBSCRIBED" as const }
  }

  await markOnboardingReoffer1hScheduled(userKey, onboardingStartedAt)
  const delivery = await scheduleOnboardingReoffer1hDelivery(userKey, onboardingStartedAt)
  return { scheduled: true as const, delivery }
}

export async function tryDeliverOnboardingReoffer1h(input: {
  userKey: string
  onboardingStartedAt: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  const scheduledMs = new Date(input.onboardingStartedAt).getTime()

  if (Number.isNaN(scheduledMs)) {
    return { sent: false as const, reason: "INVALID_SCHEDULED_AT" as const }
  }

  const subscription = await getServerSubscriptionStatus(input.userKey)
  if (subscription?.active) {
    return { sent: false as const, reason: "SUBSCRIBED" as const }
  }

  const user = await getUserAnalyticsRecord(input.userKey)
  if (!user?.onboardingReoffer1hScheduledAt) {
    return { sent: false as const, reason: "NOT_SCHEDULED" as const }
  }

  if (user.onboardingReoffer1hScheduledAt !== input.onboardingStartedAt) {
    return { sent: false as const, reason: "STALE" as const }
  }

  if (user.onboardingReoffer1hSentAt) {
    return { sent: false as const, reason: "ALREADY_SENT" as const }
  }

  const dueMs = getDueMs(user.onboardingReoffer1hScheduledAt)
  if (nowMs < dueMs - 60_000) {
    return { sent: false as const, reason: "NOT_DUE" as const }
  }

  const result = await sendMessageToUser({
    userKey: input.userKey,
    message: ONBOARDING_REOFFER_1H_MESSAGE,
  })

  if (!result.ok) {
    console.error("[onboarding-reoffer-1h] send failed", input.userKey, result.error)
    return { sent: false as const, reason: result.error ?? ("SEND_FAILED" as const) }
  }

  await updateUserAnalyticsRecord(input.userKey, (existing) => {
    if (!existing) return existing
    existing.onboardingReoffer1hSentAt = now.toISOString()
    return existing
  })

  const lifecycle = await ensureLifecycleForPendingOffer(
    input.userKey,
    user.onboardingReoffer1hScheduledAt,
  )
  lifecycle.pendingOffer = "1h" satisfies FlashSalePendingOffer
  await saveFlashSaleLifecycle(lifecycle)

  return { sent: true as const }
}

export async function processUserOnboardingReoffer1h(userKey: string, now = new Date()) {
  const user = await getUserAnalyticsRecord(userKey)
  if (!user?.onboardingReoffer1hScheduledAt || user.onboardingReoffer1hSentAt) {
    return { sent: false as const, reason: "NO_PENDING" as const }
  }

  return tryDeliverOnboardingReoffer1h({
    userKey,
    onboardingStartedAt: user.onboardingReoffer1hScheduledAt,
    now,
  })
}

function isEligibleForCron(user: UserAnalyticsRecord, nowMs: number) {
  if (!user.onboardingReoffer1hScheduledAt || user.onboardingReoffer1hSentAt) return false
  return nowMs >= getDueMs(user.onboardingReoffer1hScheduledAt)
}

export async function processPendingOnboardingReoffers1h(now = new Date()) {
  const users = Object.values((await readAnalyticsStore()).users)
  const nowMs = now.getTime()
  let sent = 0
  let pending = 0

  for (const user of users) {
    if (!user.onboardingReoffer1hScheduledAt || user.onboardingReoffer1hSentAt) continue
    if (!isEligibleForCron(user, nowMs)) {
      pending += 1
      continue
    }

    const subscription = await getServerSubscriptionStatus(user.userKey)
    if (subscription?.active) continue

    const result = await tryDeliverOnboardingReoffer1h({
      userKey: user.userKey,
      onboardingStartedAt: user.onboardingReoffer1hScheduledAt,
      now,
    })
    if (result.sent) sent += 1
  }

  return { sent, pending }
}
