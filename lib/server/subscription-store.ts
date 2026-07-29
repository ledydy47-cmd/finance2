import { eq } from "drizzle-orm"
import { getDb, hasTursoConfig } from "@/lib/db/client"
import { initTursoSchema } from "@/lib/db/init"
import { subscriptionToRecord, subscriptionToRow } from "@/lib/db/mappers"
import { subscriptions } from "@/lib/db/schema"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import { hasKvRestConfig, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import type { SubscriptionRecord, SubscriptionStoreSnapshot } from "@/lib/server/subscription-types"

const STORE_KEY = "kopilka:subscriptions"
const FILE_NAME = "subscriptions.json"
const EMPTY_STORE: SubscriptionStoreSnapshot = { records: {} }

let schemaReady = false

async function ensureTursoSchema() {
  if (!schemaReady) {
    await initTursoSchema()
    schemaReady = true
  }
}

export async function readSubscriptionStore(): Promise<SubscriptionStoreSnapshot> {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const rows = await getDb().select().from(subscriptions)
    const records: SubscriptionStoreSnapshot["records"] = {}
    for (const row of rows) {
      const record = subscriptionToRecord(row)
      records[record.userKey] = record
    }
    return { records }
  }

  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson(STORE_KEY, null)
    if (fromKv) return fromKv
  }
  return readJsonDataFile(FILE_NAME, EMPTY_STORE)
}

export async function writeSubscriptionStore(snapshot: SubscriptionStoreSnapshot) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const db = getDb()
    for (const record of Object.values(snapshot.records)) {
      await db
        .insert(subscriptions)
        .values(subscriptionToRow(record))
        .onConflictDoUpdate({
          target: subscriptions.userKey,
          set: subscriptionToRow(record),
        })
    }
    return
  }

  const payload = JSON.stringify(snapshot)
  if (hasKvRestConfig()) {
    const wroteKv = await kvRestSet(STORE_KEY, payload)
    if (wroteKv) return
    console.error("[subscription-store] KV write failed, falling back to file")
  }

  await writeJsonDataFile(FILE_NAME, snapshot)
}

export async function getSubscriptionByUserKey(userKey: string) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    const row = await getDb()
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userKey, userKey))
      .get()
    return row ? subscriptionToRecord(row) : null
  }

  const store = await readSubscriptionStore()
  return store.records[userKey] ?? null
}

export async function upsertSubscription(record: SubscriptionRecord) {
  if (hasTursoConfig()) {
    await ensureTursoSchema()
    await getDb()
      .insert(subscriptions)
      .values(subscriptionToRow(record))
      .onConflictDoUpdate({
        target: subscriptions.userKey,
        set: subscriptionToRow(record),
      })
    return record
  }

  const store = await readSubscriptionStore()
  store.records[record.userKey] = record
  await writeSubscriptionStore(store)
  return record
}

export async function listSubscriptions() {
  const store = await readSubscriptionStore()
  return Object.values(store.records)
}

export function parseTelegramUserId(userKey: string): number | null {
  if (!userKey.startsWith("tg-")) return null
  const id = Number(userKey.slice(3))
  return Number.isFinite(id) ? id : null
}
