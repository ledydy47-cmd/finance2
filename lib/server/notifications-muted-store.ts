import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"

const FILE_NAME = "notifications-muted-users.json"
const KV_KEY = "kopilka:notifications-muted-users"

export interface NotificationsMutedUserRecord {
  telegramUserId: number
  username?: string | null
  firstName?: string | null
  reason?: string | null
  mutedAt: string
}

interface NotificationsMutedUsersSnapshot {
  byTelegramUserId: Record<string, NotificationsMutedUserRecord>
}

const EMPTY_STORE: NotificationsMutedUsersSnapshot = {
  byTelegramUserId: {},
}

async function readFileStore() {
  return readJsonDataFile(FILE_NAME, EMPTY_STORE)
}

async function writeFileStore(snapshot: NotificationsMutedUsersSnapshot) {
  await writeJsonDataFile(FILE_NAME, snapshot)
}

export async function readNotificationsMutedUsers() {
  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson<NotificationsMutedUsersSnapshot>(KV_KEY, null)
    if (fromKv) return fromKv
  }

  return readFileStore()
}

export async function writeNotificationsMutedUsers(snapshot: NotificationsMutedUsersSnapshot) {
  if (hasKvRestConfig()) {
    const wrote = await kvRestSet(KV_KEY, JSON.stringify(snapshot))
    if (wrote) {
      await writeFileStore(snapshot)
      return true
    }
  }

  await writeFileStore(snapshot)
  return true
}
