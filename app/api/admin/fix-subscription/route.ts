import { NextResponse } from "next/server"
import { adminUpdateSubscription } from "@/lib/server/subscription-service"

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
      currentPeriodEnd?: string
      autoRenew?: boolean
      status?: "active" | "canceled" | "expired" | "past_due"
      plan?: "yearly" | "monthly"
    }

    if (!body.telegramUserId || !Number.isFinite(body.telegramUserId)) {
      return NextResponse.json({ error: "MISSING_TELEGRAM_USER_ID" }, { status: 400 })
    }

    const result = await adminUpdateSubscription({
      telegramUserId: body.telegramUserId,
      currentPeriodEnd: body.currentPeriodEnd,
      autoRenew: body.autoRenew,
      status: body.status,
      plan: body.plan,
    })

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 404 })
    }

    return NextResponse.json({ ok: true, subscription: result.subscription })
  } catch (error) {
    console.error("[admin/fix-subscription]", error)
    return NextResponse.json({ error: "FIX_FAILED" }, { status: 500 })
  }
}
