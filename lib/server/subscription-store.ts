import fs from "fs/promises"
import path from "path"
import type { SubscriptionRecord, SubscriptionStoreSnapshot } from "@/lib/server/subscription-types"

const STORE_KEY = "kopilka:subscriptions"
const FILE_PATH = path.join(process.cwd(), "data", "subscriptions.json")

async function readFromKv(): Promise<SubscriptionStoreSnapshot | null> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null

  const response = await fetch(`${url}/get/${encodeURIComponent(STORE_KEY)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  if (!response.ok) return null
  const payload = (await response.json()) as { result?: string | null }
  if (!payload.result) return { records: {} }
  return JSON.parse(payload.result) as SubscriptionStoreSnapshot
}

async function writeToKv(snapshot: SubscriptionStoreSnapshot) {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return false

  const response = await fetch(`${url}/set/${encodeURIComponent(STORE_KEY)}/${encodeURIComponent(JSON.stringify(snapshot))}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })

  return response.ok
}

async function readFromFile(): Promise<SubscriptionStoreSnapshot> {
  try {
    const raw = await fs.readFile(FILE_PATH, "utf8")
    return JSON.parse(raw) as SubscriptionStoreSnapshot
  } catch {
    return { records: {} }
  }
}

async function writeToFile(snapshot: SubscriptionStoreSnapshot) {
  await fs.mkdir(path.dirname(FILE_PATH), { recursive: true })
  await fs.writeFile(FILE_PATH, JSON.stringify(snapshot, null, 2), "utf8")
}

export async function readSubscriptionStore(): Promise<SubscriptionStoreSnapshot> {
  const fromKv = await readFromKv()
  if (fromKv) return fromKv
  return readFromFile()
}

export async function writeSubscriptionStore(snapshot: SubscriptionStoreSnapshot) {
  const wroteKv = await writeToKv(snapshot)
  if (!wroteKv) {
    await writeToFile(snapshot)
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
