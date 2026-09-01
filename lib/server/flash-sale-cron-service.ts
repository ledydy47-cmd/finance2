import {
  getFlashSaleTiming,
  getReofferDelayMs as getTimingReofferDelayMs,
} from "@/lib/server/flash-sale-timing"
import {
  getPaywallPromotion,
  getPromotionRemainingMs,
} from "@/lib/paywall-promotions"
import {
  getFlashSaleStartedAt,
  readFlashSaleReminders,
  scheduleFlashSaleReminder,
  writeFlashSaleReminders,
} from "@/lib/server/flash-sale-store"
import {
  clearFlashSaleLifecycle,
  getFlashSaleLifecycle,
  listTrackedFlashSaleLifecycles,
  registerFlashSaleLifecycle,
  saveFlashSaleLifecycle,
} from "@/lib/server/flash-sale-lifecycle-store"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import { sendMessageToUser } from "@/lib/server/user-analytics-service"

export const FLASH_SALE_REMINDER_MESSAGE =
  "скидка −50% заканчивается через 5 минут — успей оформить подписку, пока цена зафиксирована! 💗"

export const FLASH_SALE_OFFER_4H_MESSAGE =
  "пусть все твои мечты сбываются! А для этого мы дарим тебе скидку −50% — загляни в приложение и зафиксируй цену 💗"

export const FLASH_SALE_OFFER_24H_MESSAGE =
  "ты уже начала путь к своей цели — не останавливайся! Мы снова открыли для тебя скидку −50%. Загляни в приложение, пока она доступна ✨"

export type FlashSaleReofferType = "4h" | "24h"

/**
 * Only transient timing races should return 503 to QStash.
 * Permanent skips (STALE, NO_LIFECYCLE, ALREADY_SENT, NO_PENDING, …) must be 200
 * so QStash stops retrying and does not spike error alerts.
 */
const REOFFER_RETRY_REASONS = new Set(["NOT_DUE", "SALE_ACTIVE"])

export function shouldRetryFlashSaleReoffer(
  result: { sent: boolean; reason?: string },
) {
  return !result.sent && result.reason != null && REOFFER_RETRY_REASONS.has(result.reason)
}

export function shouldRetryFlashSaleReminder(
  result: { sent: boolean; reason?: string },
) {
  return !result.sent && result.reason === "NOT_DUE"
}

function getReofferMessage(offer: FlashSaleReofferType, isTest: boolean) {
  const message =
    offer === "4h" ? FLASH_SALE_OFFER_4H_MESSAGE : FLASH_SALE_OFFER_24H_MESSAGE
  return isTest ? `🧪 [тест] ${message}` : message
}

function formatReminderMessage(isTest: boolean) {
  return isTest ? `🧪 [тест] ${FLASH_SALE_REMINDER_MESSAGE}` : FLASH_SALE_REMINDER_MESSAGE
}

export async function tryDeliverFlashSaleReoffer(input: {
  userKey: string
  startedAt: string
  offer: FlashSaleReofferType
  now?: Date
}) {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  const startedMs = new Date(input.startedAt).getTime()

  if (Number.isNaN(startedMs)) {
    return { sent: false as const, reason: "INVALID_STARTED_AT" as const }
  }

  const subscription = await getServerSubscriptionStatus(input.userKey)
  if (subscription?.active) {
    await clearFlashSaleLifecycle(input.userKey)
    return { sent: false as const, reason: "SUBSCRIBED" as const }
  }

  const lifecycle = await getFlashSaleLifecycle(input.userKey)
  if (!lifecycle) {
    const activeStartedAt = await getFlashSaleStartedAt(input.userKey)
    if (!activeStartedAt || activeStartedAt !== input.startedAt) {
      return { sent: false as const, reason: "NO_LIFECYCLE" as const }
    }
    await registerFlashSaleLifecycle(input.userKey, input.startedAt)
  }

  const resolvedLifecycle = (await getFlashSaleLifecycle(input.userKey))!
  if (resolvedLifecycle.startedAt !== input.startedAt) {
    return { sent: false as const, reason: "STALE" as const }
  }

  const timing = await getFlashSaleTiming(input.userKey, input.startedAt)
  const alreadySent =
    input.offer === "4h" ? resolvedLifecycle.offer4hSentAt : resolvedLifecycle.offer24hSentAt
  if (alreadySent) {
    return { sent: false as const, reason: "ALREADY_SENT" as const }
  }

  const saleExpiresMs = startedMs + timing.saleDurationMs
  const dueMs = saleExpiresMs + getTimingReofferDelayMs(timing, input.offer)
  const earlyToleranceMs = timing.isTest ? 5_000 : 5 * 60_000

  if (nowMs < dueMs - earlyToleranceMs) {
    return { sent: false as const, reason: "NOT_DUE" as const }
  }

  if (!resolvedLifecycle.expiredAt && nowMs >= saleExpiresMs) {
    resolvedLifecycle.expiredAt = new Date(saleExpiresMs).toISOString()
    await saveFlashSaleLifecycle(resolvedLifecycle)
  }

  if (!resolvedLifecycle.expiredAt) {
    return { sent: false as const, reason: "SALE_ACTIVE" as const }
  }

  const result = await sendMessageToUser({
    userKey: input.userKey,
    message: getReofferMessage(input.offer, timing.isTest),
  })

  if (result.ok) {
    if (input.offer === "4h") {
      resolvedLifecycle.offer4hSentAt = now.toISOString()
      resolvedLifecycle.pendingOffer = "4h"
    } else {
      resolvedLifecycle.offer24hSentAt = now.toISOString()
      resolvedLifecycle.pendingOffer = "24h"
    }
    await saveFlashSaleLifecycle(resolvedLifecycle)
    return { sent: true as const, offer: input.offer }
  }

  console.error("[flash-sale-offer] send failed", input.userKey, input.offer, result.error)
  return { sent: false as const, reason: result.error ?? ("SEND_FAILED" as const) }
}

export async function tryDeliverFlashSaleReminder(input: {
  userKey: string
  startedAt?: string
  now?: Date
}) {
  const now = input.now ?? new Date()
  const nowMs = now.getTime()
  const reminders = await readFlashSaleReminders()
  const reminder = input.startedAt
    ? reminders.find(
        (item) =>
          item.userKey === input.userKey &&
          item.startedAt === input.startedAt &&
          !item.sent,
      )
    : reminders.find((item) => item.userKey === input.userKey && !item.sent)

  if (!reminder) {
    return { sent: false as const, reason: "NO_PENDING" as const }
  }

  if (new Date(reminder.remindAt).getTime() > nowMs) {
    return { sent: false as const, reason: "NOT_DUE" as const }
  }

  const subscription = await getServerSubscriptionStatus(input.userKey)
  if (subscription?.active) {
    reminder.sent = true
    await writeFlashSaleReminders(reminders)
    return { sent: false as const, reason: "SUBSCRIBED" as const }
  }

  const activeStartedAt = await getFlashSaleStartedAt(input.userKey)
  if (!activeStartedAt || activeStartedAt !== reminder.startedAt) {
    reminder.sent = true
    await writeFlashSaleReminders(reminders)
    return { sent: false as const, reason: "STALE" as const }
  }

  const timing = await getFlashSaleTiming(input.userKey, reminder.startedAt)
  const expiresMs = new Date(activeStartedAt).getTime() + timing.saleDurationMs
  const deliveryGraceMs = timing.isTest ? 60_000 : 5 * 60 * 1000
  if (nowMs >= expiresMs + deliveryGraceMs) {
    reminder.sent = true
    await writeFlashSaleReminders(reminders)
    return { sent: false as const, reason: "EXPIRED" as const }
  }

  const result = await sendMessageToUser({
    userKey: input.userKey,
    message: formatReminderMessage(timing.isTest),
  })

  if (result.ok) {
    reminder.sent = true
    await writeFlashSaleReminders(reminders)
    return { sent: true as const }
  }

  console.error("[flash-sale-reminder] send failed", input.userKey, result.error)
  return { sent: false as const, reason: result.error ?? ("SEND_FAILED" as const) }
}

async function processFiveMinuteReminders(now: Date) {
  const reminders = await readFlashSaleReminders()
  const nowMs = now.getTime()
  let sent = 0

  for (const reminder of reminders) {
    if (reminder.sent) continue
    if (new Date(reminder.remindAt).getTime() > nowMs) continue

    const result = await tryDeliverFlashSaleReminder({
      userKey: reminder.userKey,
      startedAt: reminder.startedAt,
      now,
    })
    if (result.sent) sent += 1
  }

  const fresh = await readFlashSaleReminders()
  const cutoffMs = nowMs - 24 * 60 * 60 * 1000
  const cleaned = fresh.filter((item) => {
    if (!item.sent) return true
    return new Date(item.remindAt).getTime() > cutoffMs
  })

  await writeFlashSaleReminders(cleaned)

  return { sent, pending: cleaned.filter((item) => !item.sent).length }
}

export async function processUserFlashSaleReminder(userKey: string, now = new Date()) {
  return tryDeliverFlashSaleReminder({ userKey, now })
}

export async function processUserFlashSaleReoffers(userKey: string, now = new Date()) {
  const lifecycle = await getFlashSaleLifecycle(userKey)
  if (!lifecycle) {
    return { sent4h: false, sent24h: false, reason: "NO_LIFECYCLE" as const }
  }

  const startedAt = lifecycle.startedAt
  const results = {
    offer4h: await tryDeliverFlashSaleReoffer({ userKey, startedAt, offer: "4h", now }),
    offer24h: await tryDeliverFlashSaleReoffer({ userKey, startedAt, offer: "24h", now }),
  }

  return {
    sent4h: results.offer4h.sent,
    sent24h: results.offer24h.sent,
    results,
  }
}

async function processReengagementOffers(now: Date) {
  const nowMs = now.getTime()
  let sent4h = 0
  let sent24h = 0
  let expiredMarked = 0

  const lifecycles = await listTrackedFlashSaleLifecycles()

  for (const lifecycle of lifecycles) {
    const subscription = await getServerSubscriptionStatus(lifecycle.userKey)
    if (subscription?.active) {
      await clearFlashSaleLifecycle(lifecycle.userKey)
      continue
    }

    const startedAt = await getFlashSaleStartedAt(lifecycle.userKey)
    if (!startedAt) {
      await clearFlashSaleLifecycle(lifecycle.userKey)
      continue
    }

    lifecycle.startedAt = startedAt
    const timing = await getFlashSaleTiming(lifecycle.userKey, startedAt)
    const saleExpiresMs = new Date(startedAt).getTime() + timing.saleDurationMs

    if (!lifecycle.expiredAt && nowMs >= saleExpiresMs) {
      lifecycle.expiredAt = new Date(saleExpiresMs).toISOString()
      expiredMarked += 1
      await saveFlashSaleLifecycle(lifecycle)
    }

    if (!lifecycle.expiredAt) {
      await saveFlashSaleLifecycle(lifecycle)
      continue
    }

    const current = (await getFlashSaleLifecycle(lifecycle.userKey)) ?? lifecycle
    const expiredMs = new Date(current.expiredAt ?? lifecycle.expiredAt!).getTime()
    const currentTiming = await getFlashSaleTiming(current.userKey, current.startedAt)

    if (!current.offer4hSentAt && nowMs >= expiredMs + currentTiming.reoffer4hMs) {
      const result = await tryDeliverFlashSaleReoffer({
        userKey: current.userKey,
        startedAt: current.startedAt,
        offer: "4h",
        now,
      })
      if (result.sent) sent4h += 1
    }

    if (!current.offer24hSentAt && nowMs >= expiredMs + currentTiming.reoffer24hMs) {
      const result = await tryDeliverFlashSaleReoffer({
        userKey: current.userKey,
        startedAt: current.startedAt,
        offer: "24h",
        now,
      })
      if (result.sent) sent24h += 1
    }
  }

  return { sent4h, sent24h, expiredMarked }
}

export async function processFlashSaleCronJobs(now = new Date()) {
  const reminders = await processFiveMinuteReminders(now)
  const reengagement = await processReengagementOffers(now)

  return {
    reminders,
    reengagement,
  }
}

export async function activatePendingFlashSaleOffer(userKey: string, now = new Date()) {
  const subscription = await getServerSubscriptionStatus(userKey)
  if (subscription?.active) {
    return { activated: false as const, reason: "SUBSCRIBED" as const }
  }

  const lifecycle = await getFlashSaleLifecycle(userKey)
  if (!lifecycle?.pendingOffer && !lifecycle?.pendingPromotionId) {
    return { activated: false as const, reason: "NO_PENDING_OFFER" as const }
  }

  const startedAt = now.toISOString()
  const offerType = lifecycle.pendingOffer
  const promotionId = lifecycle.pendingPromotionId
  const promotion = getPaywallPromotion(promotionId)
  const saleDurationMs =
    promotion?.fixedEndsAt && promotion
      ? getPromotionRemainingMs(promotion, now.getTime())
      : undefined

  const { setFlashSaleStartedAt } = await import("@/lib/server/flash-sale-store")
  await setFlashSaleStartedAt(userKey, startedAt)

  if (!promotion?.fixedEndsAt) {
    const { scheduleFlashSaleReminderDelivery, scheduleFlashSaleReofferDeliveries } =
      await import("@/lib/server/flash-sale-reminder-scheduler")
    await scheduleFlashSaleReminder(userKey, startedAt)
    await scheduleFlashSaleReminderDelivery(userKey, startedAt)
    await scheduleFlashSaleReofferDeliveries(userKey, startedAt)
  }

  lifecycle.startedAt = startedAt
  lifecycle.expiredAt = null
  lifecycle.pendingOffer = null
  lifecycle.pendingPromotionId = null
  if (promotionId) {
    lifecycle.promotionId = promotionId
  }
  await saveFlashSaleLifecycle(lifecycle)

  return {
    activated: true as const,
    startedAt,
    offerType,
    promotionId: lifecycle.promotionId,
    saleDurationMs,
    promotionEndsAt: promotion?.endsAt ?? null,
  }
}
