import { NextResponse } from "next/server"
import { isTelegramUserBlocked } from "@/lib/server/blocked-users-service"
import { grantManualSubscription } from "@/lib/server/subscription-service"
import { getSubscriptionByUserKey } from "@/lib/server/subscription-store"
import { registerTelegramUser } from "@/lib/server/telegram-users"
import { ensureAnalyticsUser } from "@/lib/server/user-analytics-service"
import { isSubscriptionActive } from "@/lib/subscription"

function shouldAutoGrantTestSubscription(username?: string | null) {
  if (!username) return false
  const allowed = (process.env.TEST_GRANT_SUBSCRIPTION_USERNAMES ?? "dinnetta")
    .split(",")
    .map((item) => item.trim().replace(/^@/, "").toLowerCase())
    .filter(Boolean)
  return allowed.includes(username.replace(/^@/, "").toLowerCase())
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      telegramUserId?: number
      username?: string | null
      firstName?: string | null
    }

    if (!body.telegramUserId || !Number.isFinite(body.telegramUserId)) {
      return NextResponse.json({ error: "MISSING_TELEGRAM_USER_ID" }, { status: 400 })
    }

    if (await isTelegramUserBlocked(body.telegramUserId)) {
      return NextResponse.json({ error: "USER_BLOCKED", blocked: true }, { status: 403 })
    }

    const record = await registerTelegramUser({
      telegramUserId: body.telegramUserId,
      username: body.username,
      firstName: body.firstName,
    })

    await ensureAnalyticsUser({
      userKey: record.userKey,
      telegramUserId: body.telegramUserId,
      telegramUsername: body.username,
      userName: body.firstName,
    })

    if (shouldAutoGrantTestSubscription(body.username)) {
      const userKey = `tg-${body.telegramUserId}`
      const existing = await getSubscriptionByUserKey(userKey)
      const needsTestGrant =
        !existing || !isSubscriptionActive(existing.currentPeriodEnd)

      if (needsTestGrant) {
        await grantManualSubscription({
          telegramUserId: body.telegramUserId,
          plan: "yearly",
        })
      }
    }

    return NextResponse.json({ ok: true, userKey: record.userKey })
  } catch (error) {
    console.error("[user/register-telegram]", error)
    return NextResponse.json({ error: "REGISTER_FAILED" }, { status: 500 })
  }
}
