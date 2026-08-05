import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"

const FILE_NAME = "blocked-users.json"
const KV_KEY = "kopilka:blocked-users"

export interface BlockedUserRecord {
  telegramUserId: number
  username?: string | null
  firstName?: string | null
  reason?: string | null
  blockedAt: string
}

interface BlockedUsersSnapshot {
  byTelegramUserId: Record<string, BlockedUserRecord>
}

const EMPTY_STORE: BlockedUsersSnapshot = {
  byTelegramUserId: {},
}

async function readFileStore() {
  return readJsonDataFile(FILE_NAME, EMPTY_STORE)
}

async function writeFileStore(snapshot: BlockedUsersSnapshot) {
  await writeJsonDataFile(FILE_NAME, snapshot)
}

export async function readBlockedUsers() {
  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson<BlockedUsersSnapshot>(KV_KEY, null)
    if (fromKv) return fromKv
  }

  return readFileStore()
}

export async function writeBlockedUsers(snapshot: BlockedUsersSnapshot) {
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
