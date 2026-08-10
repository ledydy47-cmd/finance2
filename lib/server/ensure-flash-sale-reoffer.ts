import {
  tryDeliverFlashSaleReoffer,
  type FlashSaleReofferType,
} from "@/lib/server/flash-sale-cron-service"
import {
  getFlashSaleLifecycle,
  registerFlashSaleLifecycle,
  saveFlashSaleLifecycle,
} from "@/lib/server/flash-sale-lifecycle-store"
import { scheduleFlashSaleReofferDelivery } from "@/lib/server/flash-sale-reminder-scheduler"
import { getFlashSaleStartedAt } from "@/lib/server/flash-sale-store"
import { getFlashSaleTiming, getReofferScheduleDelayMs } from "@/lib/server/flash-sale-timing"
import { getServerSubscriptionStatus } from "@/lib/server/subscription-service"
import { isUserKeyNotificationsMuted } from "@/lib/server/notifications-muted-service"

export async function getFlashSaleUserStatus(userKey: string) {
  const [subscription, startedAt, lifecycle, muted] = await Promise.all([
    getServerSubscriptionStatus(userKey),
    getFlashSaleStartedAt(userKey),
    getFlashSaleLifecycle(userKey),
    isUserKeyNotificationsMuted(userKey),
  ])

  const timing = startedAt ? await getFlashSaleTiming(userKey, startedAt) : null
  const nowMs = Date.now()
  const saleExpiresMs =
    startedAt && timing ? new Date(startedAt).getTime() + timing.saleDurationMs : null
  const offer4hDueMs =
    saleExpiresMs && timing ? saleExpiresMs + timing.reoffer4hMs : null
  const offer24hDueMs =
    saleExpiresMs && timing ? saleExpiresMs + timing.reoffer24hMs : null

  return {
    userKey,
    subscribed: Boolean(subscription?.active),
    notificationsMuted: muted,
    startedAt,
    lifecycle,
    timing,
    saleExpiresAt: saleExpiresMs ? new Date(saleExpiresMs).toISOString() : null,
    offer4hDueAt: offer4hDueMs ? new Date(offer4hDueMs).toISOString() : null,
    offer24hDueAt: offer24hDueMs ? new Date(offer24hDueMs).toISOString() : null,
    offer4hDueNow: offer4hDueMs != null && nowMs >= offer4hDueMs - 5 * 60_000,
    offer24hDueNow: offer24hDueMs != null && nowMs >= offer24hDueMs - 5 * 60_000,
  }
}

export async function ensureFlashSaleReoffer(input: {
  userKey: string
  offer?: FlashSaleReofferType
  now?: Date
}) {
  const offer = input.offer ?? "4h"
  const now = input.now ?? new Date()
  const status = await getFlashSaleUserStatus(input.userKey)

  if (status.subscribed) {
    return { ok: false as const, error: "SUBSCRIBED" as const, status }
  }

  if (status.notificationsMuted) {
    return { ok: false as const, error: "NOTIFICATIONS_MUTED" as const, status }
  }

  const startedAt = status.startedAt ?? status.lifecycle?.startedAt ?? null
  if (!startedAt) {
    return { ok: false as const, error: "NO_FLASH_SALE" as const, status }
  }

  let lifecycle = status.lifecycle ?? (await registerFlashSaleLifecycle(input.userKey, startedAt))
  if (lifecycle.startedAt !== startedAt) {
    lifecycle.startedAt = startedAt
  }

  const timing = await getFlashSaleTiming(input.userKey, startedAt)
  const saleExpiresMs = new Date(startedAt).getTime() + timing.saleDurationMs
  if (!lifecycle.expiredAt && now.getTime() >= saleExpiresMs) {
    lifecycle.expiredAt = new Date(saleExpiresMs).toISOString()
    await saveFlashSaleLifecycle(lifecycle)
  }

  const alreadySent = offer === "4h" ? lifecycle.offer4hSentAt : lifecycle.offer24hSentAt
  if (alreadySent) {
    return {
      ok: true as const,
      action: "ALREADY_SENT" as const,
      sentAt: alreadySent,
      status: await getFlashSaleUserStatus(input.userKey),
    }
  }

  const dueMs = saleExpiresMs + (offer === "4h" ? timing.reoffer4hMs : timing.reoffer24hMs)
  if (now.getTime() >= dueMs - (timing.isTest ? 5_000 : 5 * 60_000)) {
    const delivery = await tryDeliverFlashSaleReoffer({
      userKey: input.userKey,
      startedAt,
      offer,
      now,
    })

    return {
      ok: delivery.sent,
      action: delivery.sent ? ("DELIVERED" as const) : ("DELIVERY_SKIPPED" as const),
      delivery,
      status: await getFlashSaleUserStatus(input.userKey),
    }
  }

  const schedule = await scheduleFlashSaleReofferDelivery(input.userKey, startedAt, offer, timing)
  const delayMs = Math.max(0, dueMs - now.getTime())

  return {
    ok: schedule.scheduled,
    action: "SCHEDULED" as const,
    schedule,
    dueAt: new Date(dueMs).toISOString(),
    delayMs,
    scheduleDelayMs: getReofferScheduleDelayMs(timing, offer),
    status: await getFlashSaleUserStatus(input.userKey),
  }
}
