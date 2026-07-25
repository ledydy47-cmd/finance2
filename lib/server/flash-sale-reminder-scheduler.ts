import type { FlashSaleTiming } from "@/lib/server/flash-sale-timing"
import {
  getFlashSaleTiming,
  getReofferScheduleDelayMs,
} from "@/lib/server/flash-sale-timing"
import { getQStashToken, getQStashUrl } from "@/lib/server/qstash-config"
import { getAppBaseUrl } from "@/lib/yookassa/server"

export type FlashSaleReofferType = "4h" | "24h"

async function getQStashConfig() {
  const token = await getQStashToken()
  const baseUrl = getAppBaseUrl()
  const cronSecret = process.env.CRON_SECRET

  if (!token || !baseUrl || !cronSecret) {
    return null
  }

  return { token, baseUrl, cronSecret, qstashUrl: await getQStashUrl() }
}

async function scheduleQStashDelivery(input: {
  callbackPath: string
  delayMs: number
  deduplicationId: string
  body: Record<string, unknown>
  logLabel: string
}) {
  const config = await getQStashConfig()
  if (!config) {
    console.warn(
      `[${input.logLabel}] QStash not configured (QSTASH_TOKEN / NEXT_PUBLIC_APP_URL / CRON_SECRET)`,
    )
    return { scheduled: false as const, reason: "NOT_CONFIGURED" as const }
  }

  const callbackUrl = `${config.baseUrl}${input.callbackPath}`
  const delaySeconds = Math.max(1, Math.ceil(input.delayMs / 1000))
  const notBefore = Math.ceil((Date.now() + input.delayMs) / 1000)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
    "Upstash-Forward-Authorization": `Bearer ${config.cronSecret}`,
    "Upstash-Deduplication-Id": input.deduplicationId,
    "Upstash-Retries": "5",
  }

  if (input.delayMs >= 60 * 60 * 1000) {
    headers["Upstash-Not-Before"] = `${notBefore}`
  } else {
    headers["Upstash-Delay"] = `${delaySeconds}s`
  }

  const response = await fetch(`${config.qstashUrl}/v2/publish/${callbackUrl}`, {
    method: "POST",
    headers,
    body: JSON.stringify(input.body),
    cache: "no-store",
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`[${input.logLabel}] QStash schedule failed`, response.status, text)
    return {
      scheduled: false as const,
      reason: "QSTASH_FAILED" as const,
      status: response.status,
      detail: text.slice(0, 200),
    }
  }

  const payload = (await response.json()) as { messageId?: string }
  console.info(`[${input.logLabel}] QStash scheduled`, input.deduplicationId, payload.messageId)
  return {
    scheduled: true as const,
    delaySeconds,
    deduplicationId: input.deduplicationId,
    messageId: payload.messageId,
  }
}

function dedupeSuffix(timing: FlashSaleTiming) {
  return timing.isTest ? "-test" : ""
}

function buildDeduplicationId(parts: string[]) {
  return parts
    .filter(Boolean)
    .join("-")
    .replace(/:/g, "-")
}

async function resolveTiming(userKey: string, startedAt: string, timing?: FlashSaleTiming) {
  return timing ?? (await getFlashSaleTiming(userKey, startedAt))
}

export async function scheduleFlashSaleReminderDelivery(
  userKey: string,
  startedAt: string,
  timing?: FlashSaleTiming,
) {
  const resolved = await resolveTiming(userKey, startedAt, timing)
  return scheduleQStashDelivery({
    callbackPath: "/api/subscription/flash-sale-reminder-deliver",
    delayMs: resolved.reminderDelayMs,
    deduplicationId: buildDeduplicationId([
      "flash-sale-reminder",
      userKey,
      startedAt,
      dedupeSuffix(resolved),
    ]),
    body: { userKey, startedAt },
    logLabel: "flash-sale-reminder",
  })
}

export async function scheduleFlashSaleReofferDelivery(
  userKey: string,
  startedAt: string,
  offer: FlashSaleReofferType,
  timing?: FlashSaleTiming,
) {
  const resolved = await resolveTiming(userKey, startedAt, timing)
  return scheduleQStashDelivery({
    callbackPath: "/api/subscription/flash-sale-offer-deliver",
    delayMs: getReofferScheduleDelayMs(resolved, offer),
    deduplicationId: buildDeduplicationId([
      `flash-sale-offer-${offer}`,
      userKey,
      startedAt,
      dedupeSuffix(resolved),
    ]),
    body: { userKey, startedAt, offer },
    logLabel: `flash-sale-offer-${offer}`,
  })
}

export async function scheduleFlashSaleReofferDeliveries(
  userKey: string,
  startedAt: string,
  timing?: FlashSaleTiming,
) {
  const [offer4h, offer24h] = await Promise.all([
    scheduleFlashSaleReofferDelivery(userKey, startedAt, "4h", timing),
    scheduleFlashSaleReofferDelivery(userKey, startedAt, "24h", timing),
  ])

  return { offer4h, offer24h }
}

export async function scheduleFlashSaleTestDeliveries(userKey: string, startedAt: string) {
  const timing = await getFlashSaleTiming(userKey, startedAt)
  const [reminder, reoffers] = await Promise.all([
    scheduleFlashSaleReminderDelivery(userKey, startedAt, timing),
    scheduleFlashSaleReofferDeliveries(userKey, startedAt, timing),
  ])

  return { timing, reminder, reoffers }
}
