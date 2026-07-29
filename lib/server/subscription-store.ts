import { hasKvRestConfig, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import { readJsonDataFile, writeJsonDataFile } from "@/lib/server/file-store"
import type { SubscriptionRecord, SubscriptionStoreSnapshot } from "@/lib/server/subscription-types"

const STORE_KEY = "kopilka:subscriptions"
const FILE_NAME = "subscriptions.json"
const EMPTY_STORE: SubscriptionStoreSnapshot = { records: {} }

export async function readSubscriptionStore(): Promise<SubscriptionStoreSnapshot> {
  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson(STORE_KEY, null)
    if (fromKv) return fromKv
  }
  return readJsonDataFile(FILE_NAME, EMPTY_STORE)
}

export async function writeSubscriptionStore(snapshot: SubscriptionStoreSnapshot) {
  const payload = JSON.stringify(snapshot)
  if (hasKvRestConfig()) {
    const wroteKv = await kvRestSet(STORE_KEY, payload)
    if (wroteKv) return
    console.error("[subscription-store] KV write failed, falling back to file")
  }

  await writeJsonDataFile(FILE_NAME, snapshot)
}

export async function getSubscriptionByUserKey(userKey: string) {
  const store = await readSubscriptionStore()
  return store.records[userKey] ?? null
}

export async function upsertSubscription(record: SubscriptionRecord) {
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
