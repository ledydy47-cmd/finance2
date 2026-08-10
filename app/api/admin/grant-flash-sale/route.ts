import { NextResponse } from "next/server"
import {
  grantCustomFlashSale,
  grantPendingFlashSaleOffer,
} from "@/lib/server/grant-custom-flash-sale"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      telegramUserId?: number
      telegramUsername?: string | null
      firstName?: string | null
      saleDurationMs?: number
      saleDurationHours?: number
      message?: string
      mode?: "active" | "pending"
      offerType?: "1h" | "4h" | "24h"
    }

    if (!body.telegramUserId || !Number.isFinite(body.telegramUserId)) {
      return NextResponse.json({ error: "MISSING_TELEGRAM_USER_ID" }, { status: 400 })
    }

    if (body.mode === "pending") {
      const result = await grantPendingFlashSaleOffer({
        telegramUserId: body.telegramUserId,
        telegramUsername: body.telegramUsername,
        firstName: body.firstName,
        offerType: body.offerType ?? "4h",
        message: body.message,
      })
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({ ok: true, ...result })
    }

    const saleDurationMs =
      body.saleDurationMs ??
      (body.saleDurationHours ? body.saleDurationHours * 60 * 60 * 1000 : 2 * 60 * 60 * 1000)

    const result = await grantCustomFlashSale({
      telegramUserId: body.telegramUserId,
      telegramUsername: body.telegramUsername,
      firstName: body.firstName,
      saleDurationMs,
      message: body.message,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[admin/grant-flash-sale]", error)
    return NextResponse.json({ error: "GRANT_FAILED" }, { status: 500 })
  }
}
