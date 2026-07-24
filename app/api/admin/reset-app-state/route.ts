import { NextResponse } from "next/server"
import { clearFlashSaleStartedAt } from "@/lib/server/flash-sale-store"
import {
  queueAppReset,
  WALKTHROUGH_RESET_PATCH,
} from "@/lib/server/app-reset"
import { adminUpdateSubscription } from "@/lib/server/subscription-service"
import { readAnalyticsStore, writeAnalyticsStore } from "@/lib/server/user-analytics-store"

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
      resetToWalkthrough?: boolean
      clearExpenseTransactions?: boolean
      settingsPatch?: Record<string, unknown>
    }

    if (!body.telegramUserId || !Number.isFinite(body.telegramUserId)) {
      return NextResponse.json({ error: "MISSING_TELEGRAM_USER_ID" }, { status: 400 })
    }

    const userKey = `tg-${body.telegramUserId}`
    const settingsPatch = body.resetToWalkthrough
      ? WALKTHROUGH_RESET_PATCH
      : (body.settingsPatch ?? {})

    const reset = await queueAppReset({
      userKey,
      settingsPatch,
      clearExpenseTransactions: body.clearExpenseTransactions ?? body.resetToWalkthrough ?? false,
    })

    if (body.resetToWalkthrough) {
      await clearFlashSaleStartedAt(userKey)
    }

    try {
      const subscriptionResult = await adminUpdateSubscription({
        telegramUserId: body.telegramUserId,
        autoRenew: false,
        status: "expired",
      })
      if (!subscriptionResult.ok) {
        // no server subscription for this user
      }
    } catch {
      // ignore subscription reset errors
    }

    const analytics = await readAnalyticsStore()
    const record = analytics.users[userKey]
    if (record) {
      record.walkthroughCompletedAt = null
      record.paywallShownAt = null
      record.subscribedMonthlyAt = null
      record.subscribedYearlyAt = null
      record.autoRenewCanceledAt = null
      record.subscriptionPlan = "none"
      record.events = record.events.filter(
        (event) =>
          event.type !== "walkthrough_completed" &&
          event.type !== "paywall_shown" &&
          event.type !== "subscription_paid_monthly" &&
          event.type !== "subscription_paid_yearly" &&
          event.type !== "auto_renew_canceled",
      )
      analytics.users[userKey] = record
      await writeAnalyticsStore(analytics)
    }

    return NextResponse.json({ ok: true, userKey, reset })
  } catch (error) {
    console.error("[admin/reset-app-state]", error)
    return NextResponse.json({ error: "RESET_FAILED" }, { status: 500 })
  }
}
