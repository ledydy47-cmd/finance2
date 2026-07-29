import fs from "fs/promises"
import path from "path"
import { getDb, hasTursoConfig } from "@/lib/db/client"
import { initTursoSchema } from "@/lib/db/init"
import {
  messageCampaignToRow,
  subscriptionToRow,
  supportTicketToRow,
  userAnalyticsToRow,
} from "@/lib/db/mappers"
import {
  messageCampaigns,
  subscriptions,
  supportTickets,
  telegramUsers,
  userAnalytics,
} from "@/lib/db/schema"
import type { SubscriptionStoreSnapshot } from "@/lib/server/subscription-types"
import type { SupportStoreSnapshot } from "@/lib/server/support-types"
import type {
  MessageCampaignStoreSnapshot,
  UserAnalyticsStoreSnapshot,
} from "@/lib/server/user-analytics-types"

const DATA_DIR = path.join(process.cwd(), "data")

async function readJson<T>(filename: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf8")
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function importAnalytics() {
  const snapshot = await readJson<UserAnalyticsStoreSnapshot>("user-analytics.json", { users: {} })
  const users = Object.values(snapshot.users)
  const db = getDb()

  for (let index = 0; index < users.length; index += 100) {
    const batch = users.slice(index, index + 100)
    for (const record of batch) {
      await db
        .insert(userAnalytics)
        .values(userAnalyticsToRow(record))
        .onConflictDoUpdate({
          target: userAnalytics.userKey,
          set: userAnalyticsToRow(record),
        })
    }
    console.log(`[import] analytics ${Math.min(index + 100, users.length)}/${users.length}`)
  }
}

async function importSubscriptions() {
  const snapshot = await readJson<SubscriptionStoreSnapshot>("subscriptions.json", { records: {} })
  const records = Object.values(snapshot.records)
  const db = getDb()

  for (const record of records) {
    await db
      .insert(subscriptions)
      .values(subscriptionToRow(record))
      .onConflictDoUpdate({
        target: subscriptions.userKey,
        set: subscriptionToRow(record),
      })
  }
  console.log(`[import] subscriptions ${records.length}`)
}

async function importSupportTickets() {
  const snapshot = await readJson<SupportStoreSnapshot>("support-tickets.json", { tickets: {} })
  const tickets = Object.values(snapshot.tickets)
  const db = getDb()

  for (const ticket of tickets) {
    await db
      .insert(supportTickets)
      .values(supportTicketToRow(ticket))
      .onConflictDoUpdate({
        target: supportTickets.id,
        set: supportTicketToRow(ticket),
      })
  }
  console.log(`[import] support tickets ${tickets.length}`)
}

async function importTelegramUsers() {
  const snapshot = await readJson<{
    byUserKey: Record<
      string,
      {
        userKey: string
        telegramUserId: number
        username: string | null
        firstName: string | null
        updatedAt: string
      }
    >
  }>("telegram-users.json", { byUserKey: {} })

  const records = Object.values(snapshot.byUserKey)
  const db = getDb()

  for (const record of records) {
    await db
      .insert(telegramUsers)
      .values({
        userKey: record.userKey,
        telegramUserId: record.telegramUserId,
        username: record.username,
        firstName: record.firstName,
        updatedAt: record.updatedAt,
      })
      .onConflictDoUpdate({
        target: telegramUsers.userKey,
        set: {
          telegramUserId: record.telegramUserId,
          username: record.username,
          firstName: record.firstName,
          updatedAt: record.updatedAt,
        },
      })
  }
  console.log(`[import] telegram users ${records.length}`)
}

async function importCampaigns() {
  const snapshot = await readJson<MessageCampaignStoreSnapshot>("message-campaigns.json", {
    campaigns: {},
  })
  const campaigns = Object.values(snapshot.campaigns)
  const db = getDb()

  for (const campaign of campaigns) {
    await db
      .insert(messageCampaigns)
      .values(messageCampaignToRow(campaign))
      .onConflictDoUpdate({
        target: messageCampaigns.id,
        set: messageCampaignToRow(campaign),
      })
  }
  console.log(`[import] campaigns ${campaigns.length}`)
}

async function main() {
  if (!hasTursoConfig()) {
    console.error("Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first")
    process.exit(1)
  }

  await initTursoSchema()
  await importAnalytics()
  await importSubscriptions()
  await importSupportTickets()
  await importTelegramUsers()
  await importCampaigns()
  console.log("[import] done")
}

void main()
