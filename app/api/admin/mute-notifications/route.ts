import { NextResponse } from "next/server"
import {
  listNotificationsMutedUsers,
  muteTelegramNotifications,
  unmuteTelegramNotifications,
} from "@/lib/server/notifications-muted-service"
import { resolveTelegramUserId } from "@/lib/server/subscription-service"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const muted = await listNotificationsMutedUsers()
  return NextResponse.json({ ok: true, muted })
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      telegramUserId?: number
      username?: string
      firstName?: string
      reason?: string
      action?: "mute" | "unmute"
    }

    const action = body.action === "unmute" ? "unmute" : "mute"

    let telegramUserId = body.telegramUserId
    if (!telegramUserId && body.username?.trim()) {
      telegramUserId = (await resolveTelegramUserId(body.username.trim())) ?? undefined
    }

    if (!telegramUserId) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 })
    }

    if (action === "unmute") {
      const result = await unmuteTelegramNotifications(telegramUserId)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404 })
      }
      return NextResponse.json({ ok: true, action: "unmuted", telegramUserId })
    }

    const record = await muteTelegramNotifications({
      telegramUserId,
      username: body.username,
      firstName: body.firstName,
      reason: body.reason,
    })

    return NextResponse.json({ ok: true, action: "muted", record })
  } catch (error) {
    console.error("[admin/mute-notifications]", error)
    return NextResponse.json({ error: "MUTE_FAILED" }, { status: 500 })
  }
}
