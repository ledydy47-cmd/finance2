import {
  readNotificationsMutedUsers,
  writeNotificationsMutedUsers,
  type NotificationsMutedUserRecord,
} from "@/lib/server/notifications-muted-store"
import { parseTelegramUserId } from "@/lib/server/subscription-store"

function recordKey(telegramUserId: number) {
  return String(telegramUserId)
}

export async function isTelegramNotificationsMuted(telegramUserId: number) {
  const store = await readNotificationsMutedUsers()
  return Boolean(store.byTelegramUserId[recordKey(telegramUserId)])
}

export async function isUserKeyNotificationsMuted(userKey: string) {
  const telegramUserId = parseTelegramUserId(userKey)
  if (!telegramUserId) return false
  return isTelegramNotificationsMuted(telegramUserId)
}

export async function listNotificationsMutedUsers() {
  const store = await readNotificationsMutedUsers()
  return Object.values(store.byTelegramUserId).sort(
    (a, b) => new Date(b.mutedAt).getTime() - new Date(a.mutedAt).getTime(),
  )
}

export async function muteTelegramNotifications(input: {
  telegramUserId: number
  username?: string | null
  firstName?: string | null
  reason?: string | null
}) {
  const store = await readNotificationsMutedUsers()
  const record: NotificationsMutedUserRecord = {
    telegramUserId: input.telegramUserId,
    username: input.username ?? null,
    firstName: input.firstName ?? null,
    reason: input.reason?.trim() || null,
    mutedAt: new Date().toISOString(),
  }

  store.byTelegramUserId[recordKey(input.telegramUserId)] = record
  await writeNotificationsMutedUsers(store)
  return record
}

export async function unmuteTelegramNotifications(telegramUserId: number) {
  const store = await readNotificationsMutedUsers()
  const key = recordKey(telegramUserId)
  if (!store.byTelegramUserId[key]) {
    return { ok: false as const, error: "NOT_MUTED" as const }
  }

  delete store.byTelegramUserId[key]
  await writeNotificationsMutedUsers(store)
  return { ok: true as const }
}
