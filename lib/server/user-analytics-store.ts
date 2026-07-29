import fs from "fs/promises"
import path from "path"
import {
  hasKvRestConfig,
  kvRestGet,
  kvRestGetJson,
  kvRestMget,
  kvRestSet,
  kvRestSetWithIndex,
  kvRestSmembers,
} from "@/lib/server/kv-rest"
import type {
  MessageCampaignStoreSnapshot,
  UserAnalyticsRecord,
  UserAnalyticsStoreSnapshot,
} from "@/lib/server/user-analytics-types"

const LEGACY_ANALYTICS_KEY = "kopilka:user-analytics"
const USER_INDEX_KEY = "kopilka:analytics:user-index"
const USER_RECORD_PREFIX = "kopilka:analytics:user:"
const CAMPAIGNS_KEY = "kopilka:message-campaigns"
const ANALYTICS_FILE = path.join(process.cwd(), "data", "user-analytics.json")
const CAMPAIGNS_FILE = path.join(process.cwd(), "data", "message-campaigns.json")
const MGET_BATCH_SIZE = 25
const LEGACY_CACHE_MS = 30_000

const EMPTY_ANALYTICS: UserAnalyticsStoreSnapshot = { users: {} }
const EMPTY_CAMPAIGNS: MessageCampaignStoreSnapshot = { campaigns: {} }

let legacyCache: { at: number; snapshot: UserAnalyticsStoreSnapshot | null } | null = null

function userRecordKey(userKey: string) {
  return `${USER_RECORD_PREFIX}${userKey}`
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value), "utf8")
}

async function readLegacyAnalyticsSnapshot(): Promise<UserAnalyticsStoreSnapshot | null> {
  const now = Date.now()
  if (legacyCache && now - legacyCache.at < LEGACY_CACHE_MS) {
    return legacyCache.snapshot
  }

  let snapshot: UserAnalyticsStoreSnapshot | null = null

  if (hasKvRestConfig()) {
    const raw = await kvRestGet(LEGACY_ANALYTICS_KEY, 5)
    if (raw) {
      try {
        snapshot = JSON.parse(raw) as UserAnalyticsStoreSnapshot
      } catch (error) {
        console.error("[user-analytics-store] invalid legacy KV payload", error)
      }
    }
  }

  if (!snapshot) {
    const fromFile = await readJsonFile(ANALYTICS_FILE, null as UserAnalyticsStoreSnapshot | null)
    if (fromFile?.users && Object.keys(fromFile.users).length > 0) {
      snapshot = fromFile
    }
  }

  legacyCache = { at: now, snapshot }
  return snapshot
}

async function saveUserAnalyticsRecord(record: UserAnalyticsRecord) {
  const wrote = await kvRestSetWithIndex({
    recordKey: userRecordKey(record.userKey),
    value: JSON.stringify(record),
    indexKey: USER_INDEX_KEY,
    indexMember: record.userKey,
  })
  if (!wrote) {
    throw new Error(`ANALYTICS_USER_WRITE_FAILED:${record.userKey}`)
  }
}

async function loadShardedUsers(
  userKeys: string[],
  legacy: UserAnalyticsStoreSnapshot | null,
): Promise<Record<string, UserAnalyticsRecord>> {
  const users: Record<string, UserAnalyticsRecord> = { ...(legacy?.users ?? {}) }

  for (let offset = 0; offset < userKeys.length; offset += MGET_BATCH_SIZE) {
    const chunk = userKeys.slice(offset, offset + MGET_BATCH_SIZE)
    const records = await kvRestMget<UserAnalyticsRecord>(chunk.map(userRecordKey))
    chunk.forEach((userKey, index) => {
      const record = records[index] ?? legacy?.users[userKey]
      if (record) {
        users[userKey] = record
      }
    })
  }

  return users
}

export async function readAnalyticsStore(): Promise<UserAnalyticsStoreSnapshot> {
  if (!hasKvRestConfig()) {
    return readJsonFile(ANALYTICS_FILE, EMPTY_ANALYTICS)
  }

  const legacy = await readLegacyAnalyticsSnapshot()
  const legacyUsers = legacy?.users ?? {}
  const indexed = await kvRestSmembers(USER_INDEX_KEY)
  const allKeys = Array.from(new Set([...Object.keys(legacyUsers), ...indexed]))

  if (allKeys.length === 0) {
    return legacy ?? EMPTY_ANALYTICS
  }

  const users = await loadShardedUsers(allKeys, legacy)
  return { users }
}

export async function getUserAnalyticsRecord(userKey: string) {
  if (hasKvRestConfig()) {
    const fromShard = await kvRestGetJson<UserAnalyticsRecord | null>(userRecordKey(userKey), null)
    if (fromShard) return fromShard
  }

  const legacy = await readLegacyAnalyticsSnapshot()
  return legacy?.users[userKey] ?? null
}

export async function updateUserAnalyticsRecord(
  userKey: string,
  mutator: (existing: UserAnalyticsRecord | null) => UserAnalyticsRecord,
) {
  const existing = await getUserAnalyticsRecord(userKey)
  const record = mutator(existing)

  if (hasKvRestConfig()) {
    await saveUserAnalyticsRecord(record)
    return record
  }

  const fromFile = await readJsonFile(ANALYTICS_FILE, EMPTY_ANALYTICS)
  fromFile.users[userKey] = record
  await writeJsonFile(ANALYTICS_FILE, fromFile)
  return record
}

export async function writeAnalyticsStore(snapshot: UserAnalyticsStoreSnapshot) {
  if (!hasKvRestConfig()) {
    try {
      await writeJsonFile(ANALYTICS_FILE, snapshot)
    } catch (error) {
      console.error("[user-analytics-store] write failed", error)
      throw error
    }
    return
  }

  for (const record of Object.values(snapshot.users)) {
    await saveUserAnalyticsRecord(record)
  }
}

export async function readCampaignStore(): Promise<MessageCampaignStoreSnapshot> {
  const fromKv = await kvRestGetJson(CAMPAIGNS_KEY, null)
  if (fromKv) return fromKv
  return readJsonFile(CAMPAIGNS_FILE, EMPTY_CAMPAIGNS)
}

export async function writeCampaignStore(snapshot: MessageCampaignStoreSnapshot) {
  const payload = JSON.stringify(snapshot)
  const wrote = await kvRestSet(CAMPAIGNS_KEY, payload)
  if (wrote) return

  try {
    await writeJsonFile(CAMPAIGNS_FILE, snapshot)
  } catch (error) {
    console.error("[campaign-store] write failed", error)
    throw error
  }
}
