import fs from "fs/promises"
import path from "path"
import {
  hasKvRestConfig,
  kvRestGet,
  kvRestGetJson,
  kvRestMget,
  kvRestSadd,
  kvRestSet,
  kvRestSmembers,
} from "@/lib/server/kv-rest"
import type {
  MessageCampaignStoreSnapshot,
  UserAnalyticsRecord,
  UserAnalyticsStoreSnapshot,
} from "@/lib/server/user-analytics-types"

const LEGACY_ANALYTICS_KEY = "kopilka:user-analytics"
const ANALYTICS_MIGRATED_KEY = "kopilka:analytics:v2-migrated"
const USER_INDEX_KEY = "kopilka:analytics:user-index"
const USER_RECORD_PREFIX = "kopilka:analytics:user:"
const CAMPAIGNS_KEY = "kopilka:message-campaigns"
const ANALYTICS_FILE = path.join(process.cwd(), "data", "user-analytics.json")
const CAMPAIGNS_FILE = path.join(process.cwd(), "data", "message-campaigns.json")
const MGET_BATCH_SIZE = 100

const EMPTY_ANALYTICS: UserAnalyticsStoreSnapshot = { users: {} }
const EMPTY_CAMPAIGNS: MessageCampaignStoreSnapshot = { campaigns: {} }

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
  if (hasKvRestConfig()) {
    const raw = await kvRestGet(LEGACY_ANALYTICS_KEY, 5)
    if (raw) {
      try {
        return JSON.parse(raw) as UserAnalyticsStoreSnapshot
      } catch (error) {
        console.error("[user-analytics-store] invalid legacy KV payload", error)
      }
    }
  }

  const fromFile = await readJsonFile(ANALYTICS_FILE, null as UserAnalyticsStoreSnapshot | null)
  if (fromFile?.users && Object.keys(fromFile.users).length > 0) {
    return fromFile
  }

  return null
}

async function saveUserAnalyticsRecord(record: UserAnalyticsRecord) {
  const wrote = await kvRestSet(userRecordKey(record.userKey), JSON.stringify(record))
  if (!wrote) {
    throw new Error(`ANALYTICS_USER_WRITE_FAILED:${record.userKey}`)
  }
  await kvRestSadd(USER_INDEX_KEY, record.userKey)
}

export async function getUserAnalyticsRecord(userKey: string) {
  await ensureAnalyticsMigrated()
  return kvRestGetJson<UserAnalyticsRecord | null>(userRecordKey(userKey), null)
}

export async function updateUserAnalyticsRecord(
  userKey: string,
  mutator: (existing: UserAnalyticsRecord | null) => UserAnalyticsRecord,
) {
  await ensureAnalyticsMigrated()
  const existing = await getUserAnalyticsRecord(userKey)
  const record = mutator(existing)
  await saveUserAnalyticsRecord(record)
  return record
}

export async function ensureAnalyticsMigrated() {
  if (!hasKvRestConfig()) return

  const migrated = await kvRestGetJson<boolean>(ANALYTICS_MIGRATED_KEY, false)
  if (migrated) return

  const legacy = await readLegacyAnalyticsSnapshot()
  if (legacy?.users) {
    for (const record of Object.values(legacy.users)) {
      await saveUserAnalyticsRecord(record)
    }
  }

  await kvRestSet(ANALYTICS_MIGRATED_KEY, "true")
}

async function listIndexedUserKeys() {
  await ensureAnalyticsMigrated()
  if (!hasKvRestConfig()) {
    const fromFile = await readJsonFile(ANALYTICS_FILE, EMPTY_ANALYTICS)
    return Object.keys(fromFile.users)
  }

  return kvRestSmembers(USER_INDEX_KEY)
}

export async function readAnalyticsStore(): Promise<UserAnalyticsStoreSnapshot> {
  const userKeys = await listIndexedUserKeys()
  if (userKeys.length === 0) {
    if (!hasKvRestConfig()) {
      return readJsonFile(ANALYTICS_FILE, EMPTY_ANALYTICS)
    }
    return EMPTY_ANALYTICS
  }

  const users: Record<string, UserAnalyticsRecord> = {}

  for (let offset = 0; offset < userKeys.length; offset += MGET_BATCH_SIZE) {
    const chunk = userKeys.slice(offset, offset + MGET_BATCH_SIZE)
    const records = await kvRestMget<UserAnalyticsRecord>(chunk.map(userRecordKey))
    chunk.forEach((userKey, index) => {
      const record = records[index]
      if (record) {
        users[userKey] = record
      }
    })
  }

  return { users }
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

  await ensureAnalyticsMigrated()
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
