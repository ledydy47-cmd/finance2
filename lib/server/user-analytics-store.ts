import fs from "fs/promises"
import path from "path"
import type {
  MessageCampaignStoreSnapshot,
  UserAnalyticsStoreSnapshot,
} from "@/lib/server/user-analytics-types"

const ANALYTICS_KEY = "kopilka:user-analytics"
const CAMPAIGNS_KEY = "kopilka:message-campaigns"
const ANALYTICS_FILE = path.join(process.cwd(), "data", "user-analytics.json")
const CAMPAIGNS_FILE = path.join(process.cwd(), "data", "message-campaigns.json")

async function kvGet(key: string): Promise<string | null> {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return null

  const response = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!response.ok) return null
  const payload = (await response.json()) as { result?: string | null }
  return payload.result ?? null
}

async function kvSet(key: string, value: string) {
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN
  if (!url || !token) return false

  const response = await fetch(
    `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  )
  return response.ok
}

export async function readAnalyticsStore(): Promise<UserAnalyticsStoreSnapshot> {
  const fromKv = await kvGet(ANALYTICS_KEY)
  if (fromKv !== null) {
    return JSON.parse(fromKv) as UserAnalyticsStoreSnapshot
  }
  try {
    const raw = await fs.readFile(ANALYTICS_FILE, "utf8")
    return JSON.parse(raw) as UserAnalyticsStoreSnapshot
  } catch {
    return { users: {} }
  }
}

export async function writeAnalyticsStore(snapshot: UserAnalyticsStoreSnapshot) {
  const payload = JSON.stringify(snapshot)
  const wrote = await kvSet(ANALYTICS_KEY, payload)
  if (!wrote) {
    await fs.mkdir(path.dirname(ANALYTICS_FILE), { recursive: true })
    await fs.writeFile(ANALYTICS_FILE, payload, "utf8")
  }
}

export async function readCampaignStore(): Promise<MessageCampaignStoreSnapshot> {
  const fromKv = await kvGet(CAMPAIGNS_KEY)
  if (fromKv !== null) {
    return JSON.parse(fromKv) as MessageCampaignStoreSnapshot
  }
  try {
    const raw = await fs.readFile(CAMPAIGNS_FILE, "utf8")
    return JSON.parse(raw) as MessageCampaignStoreSnapshot
  } catch {
    return { campaigns: {} }
  }
}

export async function writeCampaignStore(snapshot: MessageCampaignStoreSnapshot) {
  const payload = JSON.stringify(snapshot)
  const wrote = await kvSet(CAMPAIGNS_KEY, payload)
  if (!wrote) {
    await fs.mkdir(path.dirname(CAMPAIGNS_FILE), { recursive: true })
    await fs.writeFile(CAMPAIGNS_FILE, payload, "utf8")
  }
}
