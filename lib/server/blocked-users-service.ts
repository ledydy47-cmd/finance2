import {
  readBlockedUsers,
  writeBlockedUsers,
  type BlockedUserRecord,
} from "@/lib/server/blocked-users-store"
import { parseTelegramUserId } from "@/lib/server/subscription-store"

function recordKey(telegramUserId: number) {
  return String(telegramUserId)
}

export async function isTelegramUserBlocked(telegramUserId: number) {
  const store = await readBlockedUsers()
  return Boolean(store.byTelegramUserId[recordKey(telegramUserId)])
}

export async function isUserKeyBlocked(userKey: string) {
  const telegramUserId = parseTelegramUserId(userKey)
  if (!telegramUserId) return false
  return isTelegramUserBlocked(telegramUserId)
}

export async function listBlockedUsers() {
  const store = await readBlockedUsers()
  return Object.values(store.byTelegramUserId).sort(
    (a, b) => new Date(b.blockedAt).getTime() - new Date(a.blockedAt).getTime(),
  )
}

export async function blockTelegramUser(input: {
  telegramUserId: number
  username?: string | null
  firstName?: string | null
  reason?: string | null
}) {
  const store = await readBlockedUsers()
  const record: BlockedUserRecord = {
    telegramUserId: input.telegramUserId,
    username: input.username ?? null,
    firstName: input.firstName ?? null,
    reason: input.reason?.trim() || null,
    blockedAt: new Date().toISOString(),
  }

  store.byTelegramUserId[recordKey(input.telegramUserId)] = record
  await writeBlockedUsers(store)
  return record
}

export async function unblockTelegramUser(telegramUserId: number) {
  const store = await readBlockedUsers()
  const key = recordKey(telegramUserId)
  if (!store.byTelegramUserId[key]) {
    return { ok: false as const, error: "NOT_BLOCKED" as const }
  }

  delete store.byTelegramUserId[key]
  await writeBlockedUsers(store)
  return { ok: true as const }
}
