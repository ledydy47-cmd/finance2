import fs from "fs/promises"
import path from "path"
import { kvRestGetJson, kvRestSet } from "@/lib/server/kv-rest"
import type {
  MessageCampaignStoreSnapshot,
  UserAnalyticsStoreSnapshot,
} from "@/lib/server/user-analytics-types"

const ANALYTICS_KEY = "kopilka:user-analytics"
const CAMPAIGNS_KEY = "kopilka:message-campaigns"
const ANALYTICS_FILE = path.join(process.cwd(), "data", "user-analytics.json")
const CAMPAIGNS_FILE = path.join(process.cwd(), "data", "message-campaigns.json")

const EMPTY_ANALYTICS: UserAnalyticsStoreSnapshot = { users: {} }
const EMPTY_CAMPAIGNS: MessageCampaignStoreSnapshot = { campaigns: {} }

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

export async function readAnalyticsStore(): Promise<UserAnalyticsStoreSnapshot> {
  const fromKv = await kvRestGetJson(ANALYTICS_KEY, null)
  if (fromKv) return fromKv
  return readJsonFile(ANALYTICS_FILE, EMPTY_ANALYTICS)
}

export async function writeAnalyticsStore(snapshot: UserAnalyticsStoreSnapshot) {
  const payload = JSON.stringify(snapshot)
  const wrote = await kvRestSet(ANALYTICS_KEY, payload)
  if (wrote) return

  try {
    await writeJsonFile(ANALYTICS_FILE, snapshot)
  } catch (error) {
    console.error("[user-analytics-store] write failed", error)
    throw error
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
