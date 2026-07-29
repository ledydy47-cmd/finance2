import fs from "fs/promises"
import path from "path"
import { hasKvRestConfig, kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import type { SubscriptionRecord, SubscriptionStoreSnapshot } from "@/lib/server/subscription-types"

const STORE_KEY = "kopilka:subscriptions"
const FILE_PATH = path.join(process.cwd(), "data", "subscriptions.json")
const EMPTY_STORE: SubscriptionStoreSnapshot = { records: {} }

async function readFromFile(): Promise<SubscriptionStoreSnapshot> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8")
    return JSON.parse(raw) as SubscriptionStoreSnapshot
  } catch {
    return EMPTY_STORE
  }
}

export async function readSubscriptionStore(): Promise<SubscriptionStoreSnapshot> {
  if (hasKvRestConfig()) {
    const fromKv = await kvRestGetJson(STORE_KEY, null)
    if (fromKv) return fromKv
  }
  return readFromFile()
}

export async function writeSubscriptionStore(snapshot: SubscriptionStoreSnapshot) {
  const payload = JSON.stringify(snapshot)
  if (hasKvRestConfig()) {
    const wroteKv = await kvRestSet(STORE_KEY, payload)
    if (wroteKv) return
    console.error("[subscription-store] KV write failed, falling back to file")
  }

  try {
    await fs.mkdir(path.dirname(FILE_PATH), { recursive: true })
    await fs.writeFile(FILE_PATH, payload, "utf8")
  } catch (error) {
    console.error("[subscription-store] write failed", error)
    throw error
  }
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
