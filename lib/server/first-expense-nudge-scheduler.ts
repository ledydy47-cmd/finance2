import { firstExpenseNudgeDueMs } from "@/lib/server/first-expense-nudge"
import { getQStashToken, getQStashUrl } from "@/lib/server/qstash-config"
import { getAppBaseUrl } from "@/lib/yookassa/server"

async function getQStashConfig() {
  const token = await getQStashToken()
  const baseUrl = getAppBaseUrl()
  const cronSecret = process.env.CRON_SECRET

  if (!token || !baseUrl || !cronSecret) {
    return null
  }

  return { token, baseUrl, cronSecret, qstashUrl: await getQStashUrl() }
}

export async function scheduleFirstExpenseNudgeDelivery(
  userKey: string,
  walkthroughCompletedAt: string,
) {
  const config = await getQStashConfig()
  if (!config) {
    console.warn(
      "[first-expense-nudge] QStash not configured (QSTASH_TOKEN / NEXT_PUBLIC_APP_URL / CRON_SECRET)",
    )
    return { scheduled: false as const, reason: "NOT_CONFIGURED" as const }
  }

  const dueMs = firstExpenseNudgeDueMs(walkthroughCompletedAt)
  const delayMs = Number.isNaN(dueMs) ? 2 * 60 * 60 * 1000 : Math.max(1_000, dueMs - Date.now())

  const callbackUrl = `${config.baseUrl}/api/subscription/first-expense-nudge-deliver`
  const notBefore = Math.ceil((Date.now() + delayMs) / 1000)
  const deduplicationId = [
    "first-expense-nudge",
    userKey,
    walkthroughCompletedAt.replace(/:/g, "-"),
  ].join("-")

  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.token}`,
    "Content-Type": "application/json",
    "Upstash-Forward-Authorization": `Bearer ${config.cronSecret}`,
    "Upstash-Deduplication-Id": deduplicationId,
    "Upstash-Retries": "5",
    "Upstash-Not-Before": `${notBefore}`,
  }

  const response = await fetch(`${config.qstashUrl}/v2/publish/${callbackUrl}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ userKey, walkthroughCompletedAt }),
    cache: "no-store",
  })

  if (!response.ok) {
    const text = await response.text()
    console.error("[first-expense-nudge] QStash schedule failed", response.status, text)
    return {
      scheduled: false as const,
      reason: "QSTASH_FAILED" as const,
      status: response.status,
      detail: text.slice(0, 200),
    }
  }

  const payload = (await response.json()) as { messageId?: string }
  console.info("[first-expense-nudge] QStash scheduled", deduplicationId, payload.messageId)
  return {
    scheduled: true as const,
    delayMs,
    deduplicationId,
    messageId: payload.messageId,
  }
}
