import { NextResponse } from "next/server"
import { scheduleOnboardingReoffer1hIfNeeded } from "@/lib/server/onboarding-reoffer-service"
import { getUserAnalyticsRecord } from "@/lib/server/user-analytics-store"
import { recordAnalyticsEvent } from "@/lib/server/user-analytics-service"
import type { AnalyticsEventType } from "@/lib/server/user-analytics-types"

const CLIENT_EVENTS = new Set<AnalyticsEventType>([
  "app_opened",
  "onboarding_started",
  "onboarding_completed",
  "walkthrough_completed",
  "paywall_shown",
])

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      event?: AnalyticsEventType
      userKey?: string
      telegramUserId?: number | null
      telegramUsername?: string | null
      userName?: string | null
      age?: number | null
    }

    if (!body.event || !CLIENT_EVENTS.has(body.event) || !body.userKey?.trim()) {
      return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 })
    }

    const userKey = body.userKey.trim()
    const hadOnboardingStarted = Boolean((await getUserAnalyticsRecord(userKey))?.onboardingStartedAt)

    await recordAnalyticsEvent({
      event: body.event,
      userKey,
      telegramUserId: body.telegramUserId,
      telegramUsername: body.telegramUsername,
      userName: body.userName,
      age: body.age,
    })

    if (body.event === "onboarding_started" && !hadOnboardingStarted) {
      const user = await getUserAnalyticsRecord(userKey)
      if (user?.onboardingStartedAt) {
        await scheduleOnboardingReoffer1hIfNeeded(userKey, user.onboardingStartedAt)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[analytics/track]", error)
    return NextResponse.json({ error: "TRACK_FAILED" }, { status: 500 })
  }
}
