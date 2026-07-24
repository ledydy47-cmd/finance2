import { NextResponse } from "next/server"
import {
  syncUserAppState,
  syncUserSubscriptionPlan,
} from "@/lib/server/user-analytics-service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userKey?: string
      homeWalkthroughCompleted?: boolean
      onboardingCompleted?: boolean
      userName?: string | null
      age?: number | null
    }

    if (!body.userKey?.trim()) {
      return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
    }

    const userKey = body.userKey.trim()
    await syncUserSubscriptionPlan(userKey)
    await syncUserAppState({
      userKey,
      homeWalkthroughCompleted: body.homeWalkthroughCompleted,
      onboardingCompleted: body.onboardingCompleted,
      userName: body.userName,
      age: body.age,
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[analytics/sync]", error)
    return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500 })
  }
}
