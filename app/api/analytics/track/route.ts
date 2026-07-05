import { NextResponse } from "next/server"
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

    await recordAnalyticsEvent({
      event: body.event,
      userKey: body.userKey.trim(),
      telegramUserId: body.telegramUserId,
      telegramUsername: body.telegramUsername,
      userName: body.userName,
      age: body.age,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[analytics/track]", error)
    return NextResponse.json({ error: "TRACK_FAILED" }, { status: 500 })
  }
}
