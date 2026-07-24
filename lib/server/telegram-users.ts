import { kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"

const USERS_KEY = "kopilka:telegram-users"

export interface TelegramUserRecord {
  telegramUserId: number
  username: string | null
  firstName: string | null
  userKey: string
  updatedAt: string
}

interface TelegramUsersSnapshot {
  byUserKey: Record<string, TelegramUserRecord>
  byUsername: Record<string, string>
}

const EMPTY_USERS: TelegramUsersSnapshot = { byUserKey: {}, byUsername: {} }

async function readUsers(): Promise<TelegramUsersSnapshot> {
  const fromKv = await kvRestGetJson(USERS_KEY, null)
  return fromKv ?? EMPTY_USERS
}

async function writeUsers(snapshot: TelegramUsersSnapshot) {
  const wrote = await kvRestSet(USERS_KEY, JSON.stringify(snapshot))
  if (!wrote) {
    throw new Error("Failed to write telegram users store")
  }
}

export async function registerTelegramUser(input: {
  telegramUserId: number
  username?: string | null
  firstName?: string | null
}) {
  const userKey = `tg-${input.telegramUserId}`
  const snapshot = await readUsers()
  const username = input.username?.replace(/^@/, "").toLowerCase() || null

  const record: TelegramUserRecord = {
    telegramUserId: input.telegramUserId,
    username,
    firstName: input.firstName?.trim() || null,
    userKey,
    updatedAt: new Date().toISOString(),
  }

  snapshot.byUserKey[userKey] = record
  if (username) {
    snapshot.byUsername[username] = userKey
  }

  await writeUsers(snapshot)
  return record
}

export async function findTelegramUserByUsername(username: string) {
  const normalized = username.replace(/^@/, "").toLowerCase()
  const snapshot = await readUsers()
  const userKey = snapshot.byUsername[normalized]
  if (!userKey) return null
  return snapshot.byUserKey[userKey] ?? null
}

export async function listRegisteredTelegramUsers() {
  const snapshot = await readUsers()
  return Object.values(snapshot.byUserKey)
}
