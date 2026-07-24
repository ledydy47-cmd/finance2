import { FLASH_SALE_DURATION_MS, FLASH_SALE_REMINDER_DELAY_MS } from "@/lib/paywall-experiment"

const POLL_INTERVAL_MS = 30_000
const POLL_GRACE_AFTER_REMINDER_MS = 6 * 60 * 1000

function requestFlashSaleReminderCheck(userKey: string) {
  void fetch("/api/subscription/flash-sale-reminder-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userKey }),
  })
}

export function scheduleFlashSaleReminderChecks(userKey: string, startedAt: string) {
  const startedMs = new Date(startedAt).getTime()
  if (Number.isNaN(startedMs)) return () => {}

  const remindAtMs = startedMs + FLASH_SALE_REMINDER_DELAY_MS
  const pollUntilMs = remindAtMs + POLL_GRACE_AFTER_REMINDER_MS
  const saleEndsMs = startedMs + FLASH_SALE_DURATION_MS
  const stopAtMs = Math.min(pollUntilMs, saleEndsMs + 5 * 60 * 1000)

  const timeouts: number[] = []
  let intervalId: number | undefined

  const stopPolling = () => {
    if (intervalId != null) {
      window.clearInterval(intervalId)
      intervalId = undefined
    }
  }

  const check = () => {
    if (Date.now() > stopAtMs) {
      stopPolling()
      return
    }
    requestFlashSaleReminderCheck(userKey)
  }

  const startPolling = () => {
    check()
    intervalId = window.setInterval(check, POLL_INTERVAL_MS)
  }

  const now = Date.now()
  if (now < remindAtMs) {
    timeouts.push(window.setTimeout(check, remindAtMs - now))
  }

  if (now >= remindAtMs && now <= stopAtMs) {
    startPolling()
  } else if (now < remindAtMs) {
    timeouts.push(window.setTimeout(startPolling, remindAtMs - now))
  } else {
    check()
  }

  return () => {
    for (const timeoutId of timeouts) {
      window.clearTimeout(timeoutId)
    }
    stopPolling()
  }
}
