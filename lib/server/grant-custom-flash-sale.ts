import {
  clearFlashSaleLifecycle,
  getFlashSaleLifecycle,
  registerFlashSaleLifecycle,
  saveFlashSaleLifecycle,
} from "@/lib/server/flash-sale-lifecycle-store"
import {
  scheduleFlashSaleReminderDelivery,
} from "@/lib/server/flash-sale-reminder-scheduler"
import { FLASH_SALE_OFFER_4H_MESSAGE } from "@/lib/server/flash-sale-cron-service"
import {
  clearFlashSaleReminder,
  clearFlashSaleStartedAt,
  getFlashSaleStartedAt,
  scheduleFlashSaleReminder,
  setFlashSaleStartedAt,
} from "@/lib/server/flash-sale-store"
import {
  clearFlashSaleTestSession,
  setFlashSaleTestSession,
} from "@/lib/server/flash-sale-test-mode"
import { getFlashSaleTiming } from "@/lib/server/flash-sale-timing"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import { ensureAnalyticsUser, sendMessageToUser } from "@/lib/server/user-analytics-service"

const REMINDER_BEFORE_MS = 5 * 60 * 1000

export const DEFAULT_CUSTOM_FLASH_SALE_MESSAGE = FLASH_SALE_OFFER_4H_MESSAGE

async function clearFlashSaleState(userKey: string) {
  await clearFlashSaleStartedAt(userKey)
  await clearFlashSaleReminder(userKey)
  await clearFlashSaleLifecycle(userKey)
  await clearFlashSaleTestSession(userKey)
}

export { clearFlashSaleState }

export async function grantCustomFlashSale(input: {
  telegramUserId: number
  telegramUsername?: string | null
  firstName?: string | null
  saleDurationMs: number
  message?: string
}) {
  const userKey = `tg-${input.telegramUserId}`
  const subscription = await getServerSubscriptionStatus(userKey)
  if (subscription?.active) {
    return { ok: false as const, error: "SUBSCRIBED" as const }
  }

  const startedAt = new Date().toISOString()
  const saleDurationMs = Math.max(60_000, Math.floor(input.saleDurationMs))
  const reminderDelayMs = Math.max(30_000, saleDurationMs - REMINDER_BEFORE_MS)
  const message = input.message?.trim() || DEFAULT_CUSTOM_FLASH_SALE_MESSAGE

  await clearFlashSaleState(userKey)
  await ensureAnalyticsUser({
    userKey,
    telegramUserId: input.telegramUserId,
    telegramUsername: input.telegramUsername,
    userName: input.firstName,
  })

  await setFlashSaleTestSession(userKey, startedAt, {
    saleDurationMs,
    reminderDelayMs,
    reoffer4hMs: saleDurationMs + 4 * 60 * 60 * 1000,
    reoffer24hMs: saleDurationMs + 24 * 60 * 60 * 1000,
  })
  await setFlashSaleStartedAt(userKey, startedAt)
  await scheduleFlashSaleReminder(userKey, startedAt, reminderDelayMs)

  const timing = await getFlashSaleTiming(userKey, startedAt)
  const reminderDelivery = await scheduleFlashSaleReminderDelivery(userKey, startedAt, timing)

  const lifecycle = await registerFlashSaleLifecycle(userKey, startedAt)
  lifecycle.expiredAt = new Date(new Date(startedAt).getTime() + saleDurationMs).toISOString()
  lifecycle.pendingOffer = null
  await saveFlashSaleLifecycle(lifecycle)

  const sendResult = await sendMessageToUser({ userKey, message })

  return {
    ok: true as const,
    userKey,
    startedAt,
    saleDurationMs,
    reminderDelayMs,
    reminderDelivery,
    messageSent: sendResult.ok,
    messageError: sendResult.ok ? undefined : sendResult.error,
  }
}

/** Send discount message now; 15-min timer starts only on next app open. */
export async function grantPendingFlashSaleOffer(input: {
  telegramUserId: number
  telegramUsername?: string | null
  firstName?: string | null
  offerType?: "1h" | "4h" | "24h"
  message?: string
}) {
  const userKey = `tg-${input.telegramUserId}`
  const subscription = await getServerSubscriptionStatus(userKey)
  if (subscription?.active) {
    return { ok: false as const, error: "SUBSCRIBED" as const }
  }

  const offerType = input.offerType ?? "4h"
  const message = input.message?.trim() || DEFAULT_CUSTOM_FLASH_SALE_MESSAGE

  await ensureAnalyticsUser({
    userKey,
    telegramUserId: input.telegramUserId,
    telegramUsername: input.telegramUsername,
    userName: input.firstName,
  })

  const startedAt =
    (await getFlashSaleStartedAt(userKey)) ??
    (await getFlashSaleLifecycle(userKey))?.startedAt ??
    new Date(Date.now() - 20 * 60 * 1000).toISOString()

  const lifecycle = await registerFlashSaleLifecycle(userKey, startedAt)
  if (!lifecycle.expiredAt) {
    lifecycle.expiredAt = new Date().toISOString()
  }
  lifecycle.pendingOffer = offerType
  if (offerType === "4h") lifecycle.offer4hSentAt = new Date().toISOString()
  if (offerType === "24h") lifecycle.offer24hSentAt = new Date().toISOString()
  await saveFlashSaleLifecycle(lifecycle)

  const sendResult = await sendMessageToUser({ userKey, message })

  return {
    ok: true as const,
    userKey,
    offerType,
    pendingOffer: offerType,
    messageSent: sendResult.ok,
    messageError: sendResult.ok ? undefined : sendResult.error,
  }
}
