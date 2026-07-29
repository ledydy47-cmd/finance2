import { eq } from "drizzle-orm"
import { getDb, hasTursoConfig } from "@/lib/db/client"
import { initTursoSchema } from "@/lib/db/init"
import {
  messageCampaignToRecord,
  messageCampaignToRow,
  userAnalyticsToRecord,
  userAnalyticsToRow,
} from "@/lib/db/mappers"
import { messageCampaigns, userAnalytics } from "@/lib/db/schema"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestGet, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
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

let schemaReady = false

async function ensureTursoSchema() {
  if (!schemaReady) {
    await initTursoSchema()
    schemaReady = true
  }
}

async function readLegacyAnalyticsSnapshot(): Promise<UserAnalyticsStoreSnapshot | null> {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const rows = await getDb().select().from(userAnalytics)
    if (rows.length > 0) {
      const users: Record<string, UserAnalyticsRecord> = {}
      for (const row of rows) {
        const record = userAnalyticsToRecord(row)
        users[record.userKey] = record
      }
      return { users }
    }
  }

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
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const db = getDb()
    for (const record of Object.values(snapshot.users)) {
      await db
        .insert(userAnalytics)
        .values(userAnalyticsToRow(record))
        .onConflictDoUpdate({
          target: userAnalytics.userKey,
          set: userAnalyticsToRow(record),
        })
    }
    return
  }

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
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb()
      .select()
      .from(userAnalytics)
      .where(eq(userAnalytics.userKey, userKey))
      .get()
    return row ? userAnalyticsToRecord(row) : null
  }

  const store = await readAnalyticsStore()
  return store.users[userKey] ?? null
}

export async function updateUserAnalyticsRecord(
  userKey: string,
  mutator: (existing: UserAnalyticsRecord | null) => UserAnalyticsRecord,
) {
  const existing = hasTursoConfig() ? await getUserAnalyticsRecord(userKey) : null
  const record = mutator(existing)

  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb()
      .insert(userAnalytics)
      .values(userAnalyticsToRow(record))
      .onConflictDoUpdate({
        target: userAnalytics.userKey,
        set: userAnalyticsToRow(record),
      })
    return record
  }

  const store = await readAnalyticsStore()
  store.users[userKey] = record
  await writeLegacyAnalyticsSnapshot(store)
  return record
}

export async function writeAnalyticsStore(snapshot: UserAnalyticsStoreSnapshot) {
  await writeLegacyAnalyticsSnapshot(snapshot)
}

export async function readCampaignStore(): Promise<MessageCampaignStoreSnapshot> {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const rows = await getDb().select().from(messageCampaigns)
    const campaigns: MessageCampaignStoreSnapshot["campaigns"] = {}
    for (const row of rows) {
      const campaign = messageCampaignToRecord(row)
      campaigns[campaign.id] = campaign
    }
    return { campaigns }
  }

  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson(CAMPAIGNS_KEY, null)
    if (fromKv) return fromKv
  }
  return readJsonDataFile(CAMPAIGNS_FILE, EMPTY_CAMPAIGNS)
}

export async function writeCampaignStore(snapshot: MessageCampaignStoreSnapshot) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const db = getDb()
    for (const campaign of Object.values(snapshot.campaigns)) {
      await db
        .insert(messageCampaigns)
        .values(messageCampaignToRow(campaign))
        .onConflictDoUpdate({
          target: messageCampaigns.id,
          set: messageCampaignToRow(campaign),
        })
    }
    return
  }

  const payload = JSON.stringify(snapshot)
  if (hasKvRestConfig()) {
    const wrote = await kvRestSet(CAMPAIGNS_KEY, payload)
    if (wrote) return
  }
  await writeJsonDataFile(CAMPAIGNS_FILE, snapshot)
}
