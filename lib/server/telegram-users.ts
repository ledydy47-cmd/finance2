import {
  kvRestGet,
  kvRestGetJson,
  kvRestSet,
  kvRestSetWithIndex,
  kvRestSmembers,
} from "@/lib/server/kv-rest"

const LEGACY_USERS_KEY = "kopilka:telegram-users"
const USER_RECORD_PREFIX = "kopilka:telegram-user:"
const USER_INDEX_KEY = "kopilka:telegram-user-index"
const USERNAME_PREFIX = "kopilka:telegram-username:"

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

function userRecordKey(userKey: string) {
  return `${USER_RECORD_PREFIX}${userKey}`
}

function usernameLookupKey(username: string) {
  return `${USERNAME_PREFIX}${username}`
}

async function readLegacyUsersSnapshot(): Promise<TelegramUsersSnapshot | null> {
  return kvRestGetJson<TelegramUsersSnapshot | null>(LEGACY_USERS_KEY, null)
}

async function readTelegramUserRecord(userKey: string) {
  return kvRestGetJson<TelegramUserRecord | null>(userRecordKey(userKey), null)
}

async function saveTelegramUserRecord(record: TelegramUserRecord) {
  const wrote = await kvRestSetWithIndex({
    recordKey: userRecordKey(record.userKey),
    value: JSON.stringify(record),
    indexKey: USER_INDEX_KEY,
    indexMember: record.userKey,
  })
  if (!wrote) {
    throw new Error(`TELEGRAM_USER_WRITE_FAILED:${record.userKey}`)
  }

  if (record.username) {
    const usernameWrote = await kvRestSet(usernameLookupKey(record.username), record.userKey)
    if (!usernameWrote) {
      console.error("[telegram-users] username index write failed", record.username)
    }
  }
}

export async function registerTelegramUser(input: {
  telegramUserId: number
  username?: string | null
  firstName?: string | null
}) {
  const userKey = `tg-${input.telegramUserId}`
  const username = input.username?.replace(/^@/, "").toLowerCase() || null

  const record: TelegramUserRecord = {
    telegramUserId: input.telegramUserId,
    username,
    firstName: input.firstName?.trim() || null,
    userKey,
    updatedAt: new Date().toISOString(),
  }

  await saveTelegramUserRecord(record)
  return record
}

export async function findTelegramUserByUsername(username: string) {
  const normalized = username.replace(/^@/, "").toLowerCase()
  const userKey = await kvRestGet(usernameLookupKey(normalized))
  if (userKey) {
    return readTelegramUserRecord(userKey)
  }

  const legacy = await readLegacyUsersSnapshot()
  const legacyUserKey = legacy?.byUsername[normalized]
  if (!legacyUserKey) return null
  return legacy?.byUserKey[legacyUserKey] ?? readTelegramUserRecord(legacyUserKey)
}

export async function listRegisteredTelegramUsers() {
  const indexed = await kvRestSmembers(USER_INDEX_KEY)
  const legacy = await readLegacyUsersSnapshot()
  const allKeys = Array.from(
    new Set([...Object.keys(legacy?.byUserKey ?? {}), ...indexed]),
  )

  const records: TelegramUserRecord[] = []
  for (const userKey of allKeys) {
    const fromShard = await readTelegramUserRecord(userKey)
    const record = fromShard ?? legacy?.byUserKey[userKey]
    if (record) records.push(record)
  }

  return records
}
