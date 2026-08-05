import { NextResponse } from "next/server"
import {
  blockTelegramUser,
  listBlockedUsers,
  unblockTelegramUser,
} from "@/lib/server/blocked-users-service"
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

  const blocked = await listBlockedUsers()
  return NextResponse.json({ ok: true, blocked })
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
      action?: "block" | "unblock"
    }

    const action = body.action === "unblock" ? "unblock" : "block"

    let telegramUserId = body.telegramUserId
    if (!telegramUserId && body.username?.trim()) {
      telegramUserId = (await resolveTelegramUserId(body.username.trim())) ?? undefined
    }

    if (!telegramUserId) {
      return NextResponse.json({ error: "USER_NOT_FOUND" }, { status: 404 })
    }

    if (action === "unblock") {
      const result = await unblockTelegramUser(telegramUserId)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 404 })
      }
      return NextResponse.json({ ok: true, action: "unblocked", telegramUserId })
    }

    const record = await blockTelegramUser({
      telegramUserId,
      username: body.username,
      firstName: body.firstName,
      reason: body.reason,
    })

    return NextResponse.json({ ok: true, action: "blocked", record })
  } catch (error) {
    console.error("[admin/block-user]", error)
    return NextResponse.json({ error: "BLOCK_FAILED" }, { status: 500 })
  }
}
