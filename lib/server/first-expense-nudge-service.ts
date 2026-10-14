import {
  firstExpenseNudgeDueMs,
  formatFirstExpenseNudge,
} from "@/lib/server/first-expense-nudge"
import { scheduleFirstExpenseNudgeDelivery } from "@/lib/server/first-expense-nudge-scheduler"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import { sendTelegramNotification } from "@/lib/server/telegram-notify"
import { parseTelegramUserId } from "@/lib/server/subscription-store"
import {
  getUserAnalyticsRecord,
  updateUserAnalyticsRecord,
} from "@/lib/server/user-analytics-store"
import { hasAddedFirstExpense } from "@/lib/server/user-analytics-service"

const RETRY_REASONS = new Set(["NOT_DUE", "NOT_SCHEDULED", "SEND_FAILED"])

export function shouldRetryFirstExpenseNudge(result: { sent: boolean; reason?: string }) {
  return !result.sent && result.reason != null && RETRY_REASONS.has(result.reason)
}

export async function scheduleFirstExpenseNudgeIfNeeded(
  userKey: string,
  walkthroughCompletedAt: string,
) {
  const user = await getUserAnalyticsRecord(userKey)
  if (!user?.walkthroughCompletedAt) {
    return { scheduled: false as const, reason: "NO_WALKTHROUGH" as const }
  }
  if (user.firstExpenseNudgeScheduledAt || user.firstExpenseNudgeSentAt) {
    return { scheduled: false as const, reason: "ALREADY_HANDLED" as const }
  }
  if (hasAddedFirstExpense(user)) {
    return { scheduled: false as const, reason: "HAS_EXPENSE" as const }
  }

  const subscription = await getServerSubscriptionStatus(userKey)
  if (subscription?.active) {
    return { scheduled: false as const, reason: "SUBSCRIBED" as const }
  }

  await updateUserAnalyticsRecord(userKey, (existing) => {
    if (!existing) return user
    if (existing.firstExpenseNudgeScheduledAt || existing.firstExpenseNudgeSentAt) return existing
    existing.firstExpenseNudgeScheduledAt = walkthroughCompletedAt
    return existing
  })

  const delivery = await scheduleFirstExpenseNudgeDelivery(userKey, walkthroughCompletedAt)
  return { scheduled: true as const, delivery }
}

export async function tryDeliverFirstExpenseNudge(input: {
  userKey: string
  walkthroughCompletedAt: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const scheduledMs = new Date(input.walkthroughCompletedAt).getTime()
  if (Number.isNaN(scheduledMs)) {
    return { sent: false as const, reason: "INVALID_SCHEDULED_AT" as const }
  }

  const user = await getUserAnalyticsRecord(input.userKey)
  if (!user?.firstExpenseNudgeScheduledAt) {
    return { sent: false as const, reason: "NOT_SCHEDULED" as const }
  }
  if (user.firstExpenseNudgeScheduledAt !== input.walkthroughCompletedAt) {
    return { sent: false as const, reason: "STALE" as const }
  }
  if (user.firstExpenseNudgeSentAt) {
    return { sent: false as const, reason: "ALREADY_SENT" as const }
  }
  if (hasAddedFirstExpense(user)) {
    return { sent: false as const, reason: "HAS_EXPENSE" as const }
  }

  const subscription = await getServerSubscriptionStatus(input.userKey)
  if (subscription?.active) {
    return { sent: false as const, reason: "SUBSCRIBED" as const }
  }

  const dueMs = firstExpenseNudgeDueMs(user.firstExpenseNudgeScheduledAt)
  if (Number.isNaN(dueMs) || now.getTime() < dueMs - 60_000) {
    return { sent: false as const, reason: "NOT_DUE" as const }
  }

  const { isUserKeyBlocked } = await import("@/lib/server/blocked-users-service")
  if (await isUserKeyBlocked(input.userKey)) {
    return { sent: false as const, reason: "USER_BLOCKED" as const }
  }

  const telegramUserId = user.telegramUserId ?? parseTelegramUserId(input.userKey)
  if (!telegramUserId) {
    return { sent: false as const, reason: "NO_TELEGRAM" as const }
  }

  const sendResult = await sendTelegramNotification({
    telegramUserId,
    text: formatFirstExpenseNudge(user.userName),
  })
  if (!sendResult.ok) {
    console.error("[first-expense-nudge] send failed", input.userKey, sendResult.reason)
    return { sent: false as const, reason: "SEND_FAILED" as const }
  }

  await updateUserAnalyticsRecord(input.userKey, (existing) => {
    if (!existing) return user
    existing.firstExpenseNudgeSentAt = now.toISOString()
    return existing
  })

  return { sent: true as const }
}

export async function processUserFirstExpenseNudge(userKey: string, now = new Date()) {
  const user = await getUserAnalyticsRecord(userKey)
  if (!user?.firstExpenseNudgeScheduledAt || user.firstExpenseNudgeSentAt) {
    return { sent: false as const, reason: "NO_PENDING" as const }
  }

  return tryDeliverFirstExpenseNudge({
    userKey,
    walkthroughCompletedAt: user.firstExpenseNudgeScheduledAt,
    now,
  })
}
