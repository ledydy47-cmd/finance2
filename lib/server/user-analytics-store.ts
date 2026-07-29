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
const ANALYTICS_MIGRATION_LOCK_KEY = "kopilka:analytics:v2-migration-lock"
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

async function migrateLegacySnapshot(legacy: UserAnalyticsStoreSnapshot) {
  const records = Object.values(legacy.users)
  for (const record of records) {
    await saveUserAnalyticsRecord(record)
  }
  return records.length
}

async function withMigrationLock<T>(task: () => Promise<T>): Promise<T> {
  const existingLock = await kvRestGet(ANALYTICS_MIGRATION_LOCK_KEY)
  if (existingLock) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000))
      if (!(await kvRestGet(ANALYTICS_MIGRATION_LOCK_KEY))) break
    }
  }

  await kvRestSet(ANALYTICS_MIGRATION_LOCK_KEY, Date.now().toString())
  try {
    return await task()
  } finally {
    await kvRestSet(ANALYTICS_MIGRATION_LOCK_KEY, "")
  }
}

export async function ensureAnalyticsMigrated() {
  if (!hasKvRestConfig()) return

  const migrated = await kvRestGetJson<boolean>(ANALYTICS_MIGRATED_KEY, false)
  const legacy = await readLegacyAnalyticsSnapshot()
  const legacyCount = legacy?.users ? Object.keys(legacy.users).length : 0
  const indexCount = (await kvRestSmembers(USER_INDEX_KEY)).length

  if (migrated && (legacyCount === 0 || indexCount >= legacyCount)) {
    return
  }

  await withMigrationLock(async () => {
    const latestLegacy = legacy ?? (await readLegacyAnalyticsSnapshot())
    if (!latestLegacy?.users || Object.keys(latestLegacy.users).length === 0) {
      await kvRestSet(ANALYTICS_MIGRATED_KEY, "true")
      return
    }

    const migratedCount = await migrateLegacySnapshot(latestLegacy)
    const finalIndexCount = (await kvRestSmembers(USER_INDEX_KEY)).length
    if (finalIndexCount >= migratedCount) {
      await kvRestSet(ANALYTICS_MIGRATED_KEY, "true")
    }
  })
}

export async function getUserAnalyticsRecord(userKey: string) {
  await ensureAnalyticsMigrated()
  const fromShard = await kvRestGetJson<UserAnalyticsRecord | null>(userRecordKey(userKey), null)
  if (fromShard) return fromShard

  const legacy = await readLegacyAnalyticsSnapshot()
  return legacy?.users[userKey] ?? null
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

async function listIndexedUserKeys() {
  await ensureAnalyticsMigrated()
  if (!hasKvRestConfig()) {
    const fromFile = await readJsonFile(ANALYTICS_FILE, EMPTY_ANALYTICS)
    return Object.keys(fromFile.users)
  }

  const indexed = await kvRestSmembers(USER_INDEX_KEY)
  const legacy = await readLegacyAnalyticsSnapshot()
  const legacyKeys = legacy?.users ? Object.keys(legacy.users) : []

  if (legacyKeys.length > indexed.length) {
    return legacyKeys
  }

  return indexed
}

export async function readAnalyticsStore(): Promise<UserAnalyticsStoreSnapshot> {
  const userKeys = await listIndexedUserKeys()
  if (userKeys.length === 0) {
    if (!hasKvRestConfig()) {
      return readJsonFile(ANALYTICS_FILE, EMPTY_ANALYTICS)
    }
    return EMPTY_ANALYTICS
  }

  const legacy = await readLegacyAnalyticsSnapshot()
  if (legacy && userKeys.length === Object.keys(legacy.users).length && userKeys.length > 100) {
    const indexed = await kvRestSmembers(USER_INDEX_KEY)
    if (indexed.length < userKeys.length * 0.9) {
      return legacy
    }
  }

  const users: Record<string, UserAnalyticsRecord> = {}

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
