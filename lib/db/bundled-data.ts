import fs from "fs/promises"
import path from "path"
import type { SubscriptionStoreSnapshot } from "@/lib/server/subscription-types"
import type { SupportStoreSnapshot } from "@/lib/server/support-types"
import type {
  MessageCampaignStoreSnapshot,
  UserAnalyticsStoreSnapshot,
} from "@/lib/server/user-analytics-types"
import type { TelegramUserRecord } from "@/lib/server/telegram-users"

const DATA_DIR = path.join(process.cwd(), "data")

async function readBundledJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf8")
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function readBundledAnalyticsStore() {
  return readBundledJson<UserAnalyticsStoreSnapshot>("user-analytics.json", { users: {} })
}

export async function readBundledSubscriptionStore() {
  return readBundledJson<SubscriptionStoreSnapshot>("subscriptions.json", { records: {} })
}

export async function readBundledSupportStore() {
  return readBundledJson<SupportStoreSnapshot>("support-tickets.json", { tickets: {} })
}

export async function readBundledCampaignStore() {
  return readBundledJson<MessageCampaignStoreSnapshot>("message-campaigns.json", { campaigns: {} })
}

export async function readBundledTelegramUsers() {
  const snapshot = await readBundledJson<{
    byUserKey: Record<string, TelegramUserRecord>
  }>("telegram-users.json", { byUserKey: {} })
  return Object.values(snapshot.byUserKey)
}
