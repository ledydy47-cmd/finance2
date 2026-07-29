import { NextResponse } from "next/server"
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
import { readAnalyticsStore, readCampaignStore } from "@/lib/server/user-analytics-store"
import { readSubscriptionStore } from "@/lib/server/subscription-store"
import { readSupportStore } from "@/lib/server/support-store"

export const maxDuration = 120

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

    const analytics = await readAnalyticsStore()
    const analyticsUsers = Object.values(analytics.users)
    for (const record of analyticsUsers) {
      await db
        .insert(userAnalytics)
        .values(userAnalyticsToRow(record))
        .onConflictDoUpdate({
          target: userAnalytics.userKey,
          set: userAnalyticsToRow(record),
        })
    }

    const subscriptionsSnapshot = await readSubscriptionStore()
    const subscriptionRecords = Object.values(subscriptionsSnapshot.records)
    for (const record of subscriptionRecords) {
      await db
        .insert(subscriptions)
        .values(subscriptionToRow(record))
        .onConflictDoUpdate({
          target: subscriptions.userKey,
          set: subscriptionToRow(record),
        })
    }

    const supportSnapshot = await readSupportStore()
    const tickets = Object.values(supportSnapshot.tickets)
    for (const ticket of tickets) {
      await db
        .insert(supportTickets)
        .values(supportTicketToRow(ticket))
        .onConflictDoUpdate({
          target: supportTickets.id,
          set: supportTicketToRow(ticket),
        })
    }

    const { listRegisteredTelegramUsers } = await import("@/lib/server/telegram-users")
    const telegramUserRecords = await listRegisteredTelegramUsers()
    for (const record of telegramUserRecords) {
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

    const campaignsSnapshot = await readCampaignStore()
    const campaigns = Object.values(campaignsSnapshot.campaigns)
    for (const campaign of campaigns) {
      await db
        .insert(messageCampaigns)
        .values(messageCampaignToRow(campaign))
        .onConflictDoUpdate({
          target: messageCampaigns.id,
          set: messageCampaignToRow(campaign),
        })
    }

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
