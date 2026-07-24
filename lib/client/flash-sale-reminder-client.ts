import { FLASH_SALE_DURATION_MS, FLASH_SALE_REMINDER_DELAY_MS } from "@/lib/paywall-experiment"

const STORAGE_KEY = "kopilka-flash-sale-reminder"
const POLL_INTERVAL_MS = 15_000
const POLL_GRACE_AFTER_REMINDER_MS = 6 * 60 * 1000

export interface FlashSaleReminderWatch {
  userKey: string
  startedAt: string
  remindAt: number
}

function readWatch(): FlashSaleReminderWatch | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as FlashSaleReminderWatch
    if (!parsed.userKey || !parsed.startedAt || !parsed.remindAt) return null
    return parsed
  } catch {
    return null
  }
}

export function persistFlashSaleReminderWatch(userKey: string, startedAt: string) {
  const startedMs = new Date(startedAt).getTime()
  if (Number.isNaN(startedMs)) return

  const watch: FlashSaleReminderWatch = {
    userKey,
    startedAt,
    remindAt: startedMs + FLASH_SALE_REMINDER_DELAY_MS,
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(watch))
}

export function clearFlashSaleReminderWatch(userKey: string, startedAt?: string) {
  const watch = readWatch()
  if (!watch) return
  if (watch.userKey !== userKey) return
  if (startedAt && watch.startedAt !== startedAt) return
  localStorage.removeItem(STORAGE_KEY)
}

function requestFlashSaleReminderCheck(userKey: string, startedAt?: string) {
  void fetch("/api/subscription/flash-sale-reminder-check", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userKey, startedAt }),
  })
}

export function triggerFlashSaleReminderCheck(userKey: string, startedAt?: string) {
  requestFlashSaleReminderCheck(userKey, startedAt)
}

export function scheduleFlashSaleReminderChecks(userKey: string, startedAt: string) {
  persistFlashSaleReminderWatch(userKey, startedAt)

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
    const watch = readWatch()
    if (!watch || watch.userKey !== userKey || watch.startedAt !== startedAt) return
    if (Date.now() > stopAtMs) {
      stopPolling()
      return
    }
    requestFlashSaleReminderCheck(userKey, startedAt)
  }

  const startPolling = () => {
    check()
    intervalId = window.setInterval(check, POLL_INTERVAL_MS)
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") {
      check()
    }
  }

  document.addEventListener("visibilitychange", onVisibilityChange)

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
    document.removeEventListener("visibilitychange", onVisibilityChange)
  }
}

export function resumeFlashSaleReminderWatch(userKey: string) {
  const watch = readWatch()
  if (!watch || watch.userKey !== userKey) return () => {}
  return scheduleFlashSaleReminderChecks(watch.userKey, watch.startedAt)
}
