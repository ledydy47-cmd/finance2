import { FLASH_SALE_REMINDER_DELAY_MS } from "@/lib/paywall-experiment"

function getAppBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? ""
}

function getQStashBaseUrl() {
  return (process.env.QSTASH_URL ?? "https://qstash.upstash.io").replace(/\/$/, "")
}

export async function scheduleFlashSaleReminderDelivery(userKey: string, startedAt: string) {
  const token = process.env.QSTASH_TOKEN
  const baseUrl = getAppBaseUrl()
  const cronSecret = process.env.CRON_SECRET

  if (!token || !baseUrl || !cronSecret) {
    console.warn(
      "[flash-sale-reminder] QStash not configured (QSTASH_TOKEN / NEXT_PUBLIC_APP_URL / CRON_SECRET)",
    )
    return { scheduled: false as const, reason: "NOT_CONFIGURED" as const }
  }

  const callbackUrl = `${baseUrl}/api/subscription/flash-sale-reminder-deliver`
  const delaySeconds = Math.ceil(FLASH_SALE_REMINDER_DELAY_MS / 1000)
  const deduplicationId = `flash-sale-reminder:${userKey}:${startedAt}`

  const response = await fetch(
    `${getQStashBaseUrl()}/v2/publish/${encodeURIComponent(callbackUrl)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "Upstash-Delay": `${delaySeconds}s`,
        "Upstash-Forward-Authorization": `Bearer ${cronSecret}`,
        "Upstash-Deduplication-Id": deduplicationId,
        "Upstash-Retries": "3",
      },
      body: JSON.stringify({ userKey, startedAt }),
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const text = await response.text()
    console.error("[flash-sale-reminder] QStash schedule failed", response.status, text)
    return { scheduled: false as const, reason: "QSTASH_FAILED" as const, status: response.status }
  }

  const payload = (await response.json()) as { messageId?: string }
  console.info("[flash-sale-reminder] QStash scheduled", deduplicationId, payload.messageId)
  return { scheduled: true as const, delaySeconds, deduplicationId, messageId: payload.messageId }
}
