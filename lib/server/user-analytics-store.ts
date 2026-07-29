import { hasKvRestConfig, kvRestGet, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import type {
  MessageCampaignStoreSnapshot,
  UserAnalyticsRecord,
  UserAnalyticsStoreSnapshot,
} from "@/lib/server/user-analytics-types"

const LEGACY_ANALYTICS_KEY = "kopilka:user-analytics"
const CAMPAIGNS_KEY = "kopilka:message-campaigns"
const ANALYTICS_FILE = "user-analytics.json"
const CAMPAIGNS_FILE = "message-campaigns.json"

const EMPTY_ANALYTICS: UserAnalyticsStoreSnapshot = { users: {} }
const EMPTY_CAMPAIGNS: MessageCampaignStoreSnapshot = { campaigns: {} }

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

  const fromFile = await readJsonDataFile(ANALYTICS_FILE, null as UserAnalyticsStoreSnapshot | null)
  if (fromFile?.users && Object.keys(fromFile.users).length > 0) {
    return fromFile
  }

  return null
}

async function writeLegacyAnalyticsSnapshot(snapshot: UserAnalyticsStoreSnapshot) {
  if (hasKvRestConfig()) {
    const wrote = await kvRestSet(LEGACY_ANALYTICS_KEY, JSON.stringify(snapshot))
    if (wrote) return
    console.error("[user-analytics-store] KV write failed, falling back to file")
  }

  await writeJsonDataFile(ANALYTICS_FILE, snapshot)
}

export async function readAnalyticsStore(): Promise<UserAnalyticsStoreSnapshot> {
  const legacy = await readLegacyAnalyticsSnapshot()
  return legacy ?? EMPTY_ANALYTICS
}

export async function getUserAnalyticsRecord(userKey: string) {
  const store = await readAnalyticsStore()
  return store.users[userKey] ?? null
}

export async function updateUserAnalyticsRecord(
  userKey: string,
  mutator: (existing: UserAnalyticsRecord | null) => UserAnalyticsRecord,
) {
  const store = await readAnalyticsStore()
  const record = mutator(store.users[userKey] ?? null)
  store.users[userKey] = record
  await writeLegacyAnalyticsSnapshot(store)
  return record
}

export async function writeAnalyticsStore(snapshot: UserAnalyticsStoreSnapshot) {
  await writeLegacyAnalyticsSnapshot(snapshot)
}

export async function readCampaignStore(): Promise<MessageCampaignStoreSnapshot> {
  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson(CAMPAIGNS_KEY, null)
    if (fromKv) return fromKv
  }
  return readJsonDataFile(CAMPAIGNS_FILE, EMPTY_CAMPAIGNS)
}

export async function writeCampaignStore(snapshot: MessageCampaignStoreSnapshot) {
  const payload = JSON.stringify(snapshot)
  if (hasKvRestConfig()) {
    const wrote = await kvRestSet(CAMPAIGNS_KEY, payload)
    if (wrote) return
  }
  await writeJsonDataFile(CAMPAIGNS_FILE, snapshot)
}
