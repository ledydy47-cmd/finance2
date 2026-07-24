import { kvRestDel, kvRestGet, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import {
  FLASH_SALE_DURATION_MS,
  FLASH_SALE_REMINDER_DELAY_MS,
} from "@/lib/paywall-experiment"

const flashSaleKey = (userKey: string) => `kopilka:flash-sale:${userKey}`
const REMINDERS_KEY = "kopilka:flash-sale-reminders"

export interface FlashSaleReminderRecord {
  userKey: string
  startedAt: string
  remindAt: string
  sent: boolean
}

export async function setFlashSaleStartedAt(userKey: string, startedAt: string) {
  return kvRestSet(flashSaleKey(userKey), startedAt)
}

export async function getFlashSaleStartedAt(userKey: string) {
  return kvRestGet(flashSaleKey(userKey))
}

export async function clearFlashSaleStartedAt(userKey: string) {
  const deleted = await kvRestDel(flashSaleKey(userKey))
  if (deleted) return true
  return kvRestSet(flashSaleKey(userKey), "")
}

export function isFlashSaleExpired(startedAt: string, nowMs = Date.now()) {
  const startedMs = new Date(startedAt).getTime()
  if (Number.isNaN(startedMs)) return true
  return nowMs >= startedMs + FLASH_SALE_DURATION_MS
}

export async function resolveFlashSaleStartedAt(userKey: string, clientStartedAt: string) {
  const existing = await getFlashSaleStartedAt(userKey)
  if (!existing || isFlashSaleExpired(existing)) {
    await setFlashSaleStartedAt(userKey, clientStartedAt)
    return clientStartedAt
  }
  return existing
}

export async function readFlashSaleReminders() {
  return kvRestGetJson<FlashSaleReminderRecord[]>(REMINDERS_KEY, [])
}

export async function writeFlashSaleReminders(reminders: FlashSaleReminderRecord[]) {
  return kvRestSet(REMINDERS_KEY, JSON.stringify(reminders))
}

export async function scheduleFlashSaleReminder(userKey: string, startedAt: string) {
  const startedMs = new Date(startedAt).getTime()
  if (Number.isNaN(startedMs)) return false

  const remindAt = new Date(startedMs + FLASH_SALE_REMINDER_DELAY_MS).toISOString()

  const reminders = await readFlashSaleReminders()
  const alreadyScheduled = reminders.some(
    (item) => item.userKey === userKey && item.startedAt === startedAt && !item.sent,
  )
  if (alreadyScheduled) return true

  const next = [
    ...reminders.filter((item) => !(item.userKey === userKey && !item.sent)),
    { userKey, startedAt, remindAt, sent: false },
  ]

  return writeFlashSaleReminders(next)
}

export async function clearFlashSaleReminder(userKey: string) {
  const reminders = await readFlashSaleReminders()
  const next = reminders.filter((item) => item.userKey !== userKey)
  if (next.length === reminders.length) return true
  return writeFlashSaleReminders(next)
}
