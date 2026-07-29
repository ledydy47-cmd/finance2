import { NextResponse } from "next/server"
import {
  readBundledAnalyticsStore,
  readBundledCampaignStore,
  readBundledSubscriptionStore,
  readBundledSupportStore,
  readBundledTelegramUsers,
} from "@/lib/db/bundled-data"
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
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"

export const maxDuration = 300

async function upsertInBatches<T>(
  items: T[],
  write: (item: T) => Promise<unknown>,
  batchSize = 50,
) {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize)
    await Promise.all(batch.map((item) => write(item)))
  }
}

export async function POST(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  if (!hasTursoConfig()) {
    return NextResponse.json({ error: "TURSO_NOT_CONFIGURED" }, { status: 503 })
  }

  try {
    await initTursoSchema()
    const db = getDb()

    const analyticsUsers = Object.values((await readBundledAnalyticsStore()).users)
    const subscriptionRecords = Object.values((await readBundledSubscriptionStore()).records)
    const tickets = Object.values((await readBundledSupportStore()).tickets)
    const telegramUserRecords = await readBundledTelegramUsers()
    const campaigns = Object.values((await readBundledCampaignStore()).campaigns)

    await upsertInBatches(analyticsUsers, (record) =>
      db
        .insert(userAnalytics)
        .values(userAnalyticsToRow(record))
        .onConflictDoUpdate({
          target: userAnalytics.userKey,
          set: userAnalyticsToRow(record),
        }),
    )

    await upsertInBatches(subscriptionRecords, (record) =>
      db
        .insert(subscriptions)
        .values(subscriptionToRow(record))
        .onConflictDoUpdate({
          target: subscriptions.userKey,
          set: subscriptionToRow(record),
        }),
    )

    await upsertInBatches(tickets, (ticket) =>
      db
        .insert(supportTickets)
        .values(supportTicketToRow(ticket))
        .onConflictDoUpdate({
          target: supportTickets.id,
          set: supportTicketToRow(ticket),
        }),
    )

    await upsertInBatches(telegramUserRecords, (record) =>
      db
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
        }),
    )

    await upsertInBatches(campaigns, (campaign) =>
      db
        .insert(messageCampaigns)
        .values(messageCampaignToRow(campaign))
        .onConflictDoUpdate({
          target: messageCampaigns.id,
          set: messageCampaignToRow(campaign),
        }),
    )

    return NextResponse.json({
      ok: true,
      imported: {
        analyticsUsers: analyticsUsers.length,
        subscriptions: subscriptionRecords.length,
        supportTickets: tickets.length,
        telegramUsers: telegramUserRecords.length,
        campaigns: campaigns.length,
      },
    })
  } catch (error) {
    console.error("[admin/turso-import]", error)
    return NextResponse.json({ error: "IMPORT_FAILED" }, { status: 500 })
  }
}
