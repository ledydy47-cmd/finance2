import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import {
  createMessageCampaign,
  listMessageCampaigns,
  sendMessageToFilteredUsers,
  sendMessageToUser,
} from "@/lib/server/user-analytics-service"
import type { MessageCampaignFilter } from "@/lib/server/user-analytics-types"

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const campaigns = await listMessageCampaigns()
    return NextResponse.json({ campaigns })
  } catch (error) {
    console.error("[admin/messages GET]", error)
    return NextResponse.json({ error: "LIST_FAILED" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      action?: "send_now" | "schedule" | "schedule_user"
      userKey?: string
      filter?: MessageCampaignFilter
      message?: string
      name?: string
      type?: "scheduled_broadcast" | "delayed_filter" | "scheduled_user"
      scheduledAt?: string
      delayHours?: number
    }

    const message = body.message?.trim()
    if (!message) {
      return NextResponse.json({ error: "MISSING_MESSAGE" }, { status: 400 })
    }

    if (body.action === "send_now") {
      if (body.userKey) {
        const result = await sendMessageToUser({ userKey: body.userKey, message })
        if (!result.ok) {
          return NextResponse.json({ error: result.error }, { status: 400 })
        }
        return NextResponse.json({ ok: true, sent: 1 })
      }

      const filter = body.filter ?? "all"
      const result = await sendMessageToFilteredUsers({ filter, message })
      return NextResponse.json({ ok: true, ...result })
    }

    if (body.action === "schedule") {
      const campaign = await createMessageCampaign({
        name: body.name ?? "Рассылка",
        message,
        type: body.type ?? "delayed_filter",
        filter: body.filter ?? "paywall_no_pay",
        scheduledAt: body.scheduledAt ?? null,
        delayHours: body.delayHours ?? 3,
        targetUserKey: body.type === "scheduled_user" ? body.userKey ?? null : null,
      })
      return NextResponse.json({ ok: true, campaign })
    }

    if (body.action === "schedule_user") {
      if (!body.userKey?.trim() || !body.scheduledAt) {
        return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 })
      }
      const campaign = await createMessageCampaign({
        name: body.name ?? "Сообщение пользователю",
        message,
        type: "scheduled_user",
        filter: "all",
        scheduledAt: body.scheduledAt,
        targetUserKey: body.userKey.trim(),
      })
      return NextResponse.json({ ok: true, campaign })
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400 })
  } catch (error) {
    console.error("[admin/messages POST]", error)
    return NextResponse.json({ error: "MESSAGE_FAILED" }, { status: 500 })
  }
}
