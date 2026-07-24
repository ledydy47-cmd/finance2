import {
  FLASH_SALE_DURATION_MS,
  FLASH_SALE_REMINDER_DELAY_MS,
  FLASH_SALE_REOFFER_24H_MS,
  FLASH_SALE_REOFFER_4H_MS,
} from "@/lib/paywall-experiment"

export type FlashSaleReofferType = "4h" | "24h"

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
}

function getQStashBaseUrl() {
  return (process.env.QSTASH_URL ?? "https://qstash.upstash.io").replace(/\/$/, "")
}

function getQStashConfig() {
  const token = process.env.QSTASH_TOKEN
  const baseUrl = getAppBaseUrl()
  const cronSecret = process.env.CRON_SECRET

  if (!token || !baseUrl || !cronSecret) {
    return null
  }

  return { token, baseUrl, cronSecret }
}

export function getFlashSaleReofferDelayMs(offer: FlashSaleReofferType) {
  return (
    FLASH_SALE_DURATION_MS +
    (offer === "4h" ? FLASH_SALE_REOFFER_4H_MS : FLASH_SALE_REOFFER_24H_MS)
  )
}

async function scheduleQStashDelivery(input: {
  callbackPath: string
  delayMs: number
  deduplicationId: string
  body: Record<string, unknown>
  logLabel: string
}) {
  const config = getQStashConfig()
  if (!config) {
    console.warn(
      `[${input.logLabel}] QStash not configured (QSTASH_TOKEN / NEXT_PUBLIC_APP_URL / CRON_SECRET)`,
    )
    return { scheduled: false as const, reason: "NOT_CONFIGURED" as const }
  }

  const callbackUrl = `${config.baseUrl}${input.callbackPath}`
  const delaySeconds = Math.ceil(input.delayMs / 1000)

  const response = await fetch(
    `${getQStashBaseUrl()}/v2/publish/${encodeURIComponent(callbackUrl)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
        "Upstash-Delay": `${delaySeconds}s`,
        "Upstash-Forward-Authorization": `Bearer ${config.cronSecret}`,
        "Upstash-Deduplication-Id": input.deduplicationId,
        "Upstash-Retries": "3",
      },
      body: JSON.stringify(input.body),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const text = await response.text()
    console.error(`[${input.logLabel}] QStash schedule failed`, response.status, text)
    return { scheduled: false as const, reason: "QSTASH_FAILED" as const, status: response.status }
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

export async function scheduleFlashSaleReminderDelivery(userKey: string, startedAt: string) {
  return scheduleQStashDelivery({
    callbackPath: "/api/subscription/flash-sale-reminder-deliver",
    delayMs: FLASH_SALE_REMINDER_DELAY_MS,
    deduplicationId: `flash-sale-reminder:${userKey}:${startedAt}`,
    body: { userKey, startedAt },
    logLabel: "flash-sale-reminder",
  })
}

export async function scheduleFlashSaleReofferDelivery(
  userKey: string,
  startedAt: string,
  offer: FlashSaleReofferType,
) {
  return scheduleQStashDelivery({
    callbackPath: "/api/subscription/flash-sale-offer-deliver",
    delayMs: getFlashSaleReofferDelayMs(offer),
    deduplicationId: `flash-sale-offer-${offer}:${userKey}:${startedAt}`,
    body: { userKey, startedAt, offer },
    logLabel: `flash-sale-offer-${offer}`,
  })
}

export async function scheduleFlashSaleReofferDeliveries(userKey: string, startedAt: string) {
  const [offer4h, offer24h] = await Promise.all([
    scheduleFlashSaleReofferDelivery(userKey, startedAt, "4h"),
    scheduleFlashSaleReofferDelivery(userKey, startedAt, "24h"),
  ])

  return { offer4h, offer24h }
}
