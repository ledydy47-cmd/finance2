import { hasKvRestConfig, kvRestDel, kvRestGet, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import {
  FLASH_SALE_DURATION_MS,
  FLASH_SALE_REMINDER_DELAY_MS,
} from "@/lib/paywall-experiment"

const FILE_NAME = "flash-sales.json"
const flashSaleKey = (userKey: string) => `kopilka:flash-sale:${userKey}`
const REMINDERS_KEY = "kopilka:flash-sale-reminders"

export interface FlashSaleReminderRecord {
  userKey: string
  startedAt: string
  remindAt: string
  sent: boolean
}

interface FlashSaleStoreSnapshot {
  startedAtByUserKey: Record<string, string>
  reminders: FlashSaleReminderRecord[]
}

const EMPTY_STORE: FlashSaleStoreSnapshot = {
  startedAtByUserKey: {},
  reminders: [],
}

async function readFileStore() {
  return readJsonDataFile(FILE_NAME, EMPTY_STORE)
}

async function writeFileStore(snapshot: FlashSaleStoreSnapshot) {
  await writeJsonDataFile(FILE_NAME, snapshot)
}

export async function setFlashSaleStartedAt(userKey: string, startedAt: string) {
  if (hasKvRestConfig()) {
    const wrote = await kvRestSet(flashSaleKey(userKey), startedAt)
    if (wrote) {
      const store = await readFileStore()
      store.startedAtByUserKey[userKey] = startedAt
      await writeFileStore(store)
      return true
    }
  }

  const store = await readFileStore()
  store.startedAtByUserKey[userKey] = startedAt
  await writeFileStore(store)
  return true
}

export async function getFlashSaleStartedAt(userKey: string) {
  if (hasKvRestConfig()) {
    const fromKv = await kvRestGet(flashSaleKey(userKey))
    if (fromKv) return fromKv
  }

  const store = await readFileStore()
  return store.startedAtByUserKey[userKey] ?? null
}

export async function clearFlashSaleStartedAt(userKey: string) {
  if (hasKvRestConfig()) {
    await kvRestDel(flashSaleKey(userKey))
  }

  const store = await readFileStore()
  delete store.startedAtByUserKey[userKey]
  await writeFileStore(store)
  return true
}

export function isFlashSaleExpired(
  startedAt: string,
  durationMs = FLASH_SALE_DURATION_MS,
  nowMs = Date.now(),
) {
  const startedMs = new Date(startedAt).getTime()
  if (Number.isNaN(startedMs)) return true
  return nowMs >= startedMs + durationMs
}

export async function isFlashSaleExpiredForUser(
  userKey: string,
  startedAt: string,
  nowMs = Date.now(),
) {
  const { getFlashSaleTiming } = await import("@/lib/server/flash-sale-timing")
  const timing = await getFlashSaleTiming(userKey, startedAt)
  return isFlashSaleExpired(startedAt, timing.saleDurationMs, nowMs)
}

export async function resolveFlashSaleStartedAt(userKey: string, clientStartedAt: string) {
  const existing = await getFlashSaleStartedAt(userKey)
  if (!existing || (await isFlashSaleExpiredForUser(userKey, existing))) {
    await setFlashSaleStartedAt(userKey, clientStartedAt)
    return clientStartedAt
  }
  return existing
}

export async function readFlashSaleReminders() {
  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson<FlashSaleReminderRecord[]>(REMINDERS_KEY, null)
    if (fromKv) return fromKv
  }

  const store = await readFileStore()
  return store.reminders
}

export async function writeFlashSaleReminders(reminders: FlashSaleReminderRecord[]) {
  if (hasKvRestConfig()) {
    const wrote = await kvRestSet(REMINDERS_KEY, JSON.stringify(reminders))
    if (wrote) {
      const store = await readFileStore()
      store.reminders = reminders
      await writeFileStore(store)
      return true
    }
  }

  const store = await readFileStore()
  store.reminders = reminders
  await writeFileStore(store)
  return true
}

export async function scheduleFlashSaleReminder(
  userKey: string,
  startedAt: string,
  reminderDelayMs = FLASH_SALE_REMINDER_DELAY_MS,
) {
  const startedMs = new Date(startedAt).getTime()
  if (Number.isNaN(startedMs)) return false

  const remindAt = new Date(startedMs + reminderDelayMs).toISOString()

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
