import { NextResponse } from "next/server"
import {
  grantManualSubscription,
  resolveTelegramUserId,
} from "@/lib/server/subscription-service"

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
      username?: string
      plan?: "yearly" | "monthly"
    }

    let telegramUserId = body.telegramUserId
    if (!telegramUserId && body.username?.trim()) {
      telegramUserId = (await resolveTelegramUserId(body.username.trim())) ?? undefined
    }

    if (!telegramUserId) {
      return NextResponse.json(
        {
          error: "USER_NOT_FOUND",
          message:
            "Не удалось найти Telegram ID. Откройте мини-приложение один раз или напишите боту /start.",
        },
        { status: 404 },
      )
    }

    const subscription = await grantManualSubscription({
      telegramUserId,
      plan: body.plan === "monthly" ? "monthly" : "yearly",
    })

    return NextResponse.json({ ok: true, subscription })
  } catch (error) {
    console.error("[admin/grant-subscription]", error)
    return NextResponse.json({ error: "GRANT_FAILED" }, { status: 500 })
  }
}
