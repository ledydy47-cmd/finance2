import { NextResponse } from "next/server"
import { clearFlashSaleLifecycle } from "@/lib/server/flash-sale-lifecycle-store"
import { clearFlashSaleReminder, clearFlashSaleStartedAt } from "@/lib/server/flash-sale-store"
import {
  ONBOARDING_RESET_PATCH,
  queueAppReset,
  WALKTHROUGH_RESET_PATCH,
} from "@/lib/server/app-reset"
import { adminUpdateSubscription } from "@/lib/server/subscription-service"
import { getUserAnalyticsRecord, updateUserAnalyticsRecord } from "@/lib/server/user-analytics-store"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

async function clearFlashSaleState(userKey: string) {
  await clearFlashSaleStartedAt(userKey)
  await clearFlashSaleReminder(userKey)
  await clearFlashSaleLifecycle(userKey)
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      telegramUserId?: number
      resetToOnboarding?: boolean
      resetToWalkthrough?: boolean
      clearExpenseTransactions?: boolean
      settingsPatch?: Record<string, unknown>
    }

    if (!body.telegramUserId || !Number.isFinite(body.telegramUserId)) {
      return NextResponse.json({ error: "MISSING_TELEGRAM_USER_ID" }, { status: 400 })
    }

    const userKey = `tg-${body.telegramUserId}`
    const resetToOnboarding = body.resetToOnboarding ?? false
    const resetToWalkthrough = body.resetToWalkthrough ?? false
    const settingsPatch = resetToOnboarding
      ? ONBOARDING_RESET_PATCH
      : resetToWalkthrough
        ? WALKTHROUGH_RESET_PATCH
        : (body.settingsPatch ?? {})

    const reset = await queueAppReset({
      userKey,
      settingsPatch,
      clearExpenseTransactions:
        body.clearExpenseTransactions ?? resetToOnboarding ?? resetToWalkthrough ?? false,
      resetToOnboarding,
    })

    if (resetToOnboarding || resetToWalkthrough) {
      await clearFlashSaleState(userKey)
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

    const existing = await getUserAnalyticsRecord(userKey)
    if (existing) {
      await updateUserAnalyticsRecord(userKey, (record) => {
        if (!record) return existing
        if (resetToOnboarding) {
          record.onboardingStartedAt = null
          record.onboardingCompletedAt = null
        }
        record.walkthroughCompletedAt = null
        record.homeWalkthroughCompleted = false
        record.firstExpenseAdded = false
        record.paywallShownAt = null
        record.subscribedMonthlyAt = null
        record.subscribedYearlyAt = null
        record.autoRenewCanceledAt = null
        record.subscriptionPlan = "none"
        record.events = record.events.filter(
          (event) =>
            (resetToOnboarding
              ? event.type !== "onboarding_started" && event.type !== "onboarding_completed"
              : true) &&
            event.type !== "walkthrough_completed" &&
            event.type !== "paywall_shown" &&
            event.type !== "subscription_paid_monthly" &&
            event.type !== "subscription_paid_yearly" &&
            event.type !== "auto_renew_canceled",
        )
        return record
      })
    }

    return NextResponse.json({ ok: true, userKey, reset })
  } catch (error) {
    console.error("[admin/reset-app-state]", error)
    return NextResponse.json({ error: "RESET_FAILED" }, { status: 500 })
  }
}
