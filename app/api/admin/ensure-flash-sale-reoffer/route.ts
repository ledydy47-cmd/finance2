import { NextResponse } from "next/server"
import {
  ensureFlashSaleReoffer,
  getFlashSaleUserStatus,
} from "@/lib/server/ensure-flash-sale-reoffer"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

function resolveUserKey(input: { userKey?: string; telegramUserId?: number }) {
  if (input.userKey?.trim()) return input.userKey.trim()
  if (input.telegramUserId && Number.isFinite(input.telegramUserId)) {
    return `tg-${input.telegramUserId}`
  }
  return null
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const url = new URL(request.url)
  const userKey = resolveUserKey({
    userKey: url.searchParams.get("userKey") ?? undefined,
    telegramUserId: url.searchParams.get("telegramUserId")
      ? Number(url.searchParams.get("telegramUserId"))
      : undefined,
  })

  if (!userKey) {
    return NextResponse.json({ error: "MISSING_USER" }, { status: 400 })
  }

  try {
    const status = await getFlashSaleUserStatus(userKey)
    return NextResponse.json({ ok: true, ...status })
  } catch (error) {
    console.error("[admin/ensure-flash-sale-reoffer GET]", error)
    return NextResponse.json({ error: "STATUS_FAILED" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      userKey?: string
      telegramUserId?: number
      offer?: "4h" | "24h"
    }

    const userKey = resolveUserKey(body)
    if (!userKey) {
      return NextResponse.json({ error: "MISSING_USER" }, { status: 400 })
    }

    const result = await ensureFlashSaleReoffer({
      userKey,
      offer: body.offer ?? "4h",
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[admin/ensure-flash-sale-reoffer POST]", error)
    return NextResponse.json({ error: "ENSURE_FAILED" }, { status: 500 })
  }
}
