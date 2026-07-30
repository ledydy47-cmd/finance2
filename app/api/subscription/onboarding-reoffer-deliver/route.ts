import { NextResponse } from "next/server"
import {
  shouldRetryOnboardingReoffer1h,
  tryDeliverOnboardingReoffer1h,
} from "@/lib/server/onboarding-reoffer-service"

function isAuthorized(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  return request.headers.get("authorization") === `Bearer ${cronSecret}`
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      userKey?: string
      onboardingStartedAt?: string
    }

    if (!body.userKey?.trim() || !body.onboardingStartedAt?.trim()) {
      return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 })
    }

    const result = await tryDeliverOnboardingReoffer1h({
      userKey: body.userKey.trim(),
      onboardingStartedAt: body.onboardingStartedAt.trim(),
      now: new Date(),
    })

    if (shouldRetryOnboardingReoffer1h(result)) {
      console.warn(
        "[onboarding-reoffer-deliver] retryable",
        body.userKey,
        result.reason,
      )
      return NextResponse.json({ ok: false, ...result }, { status: 503 })
    }

    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[subscription/onboarding-reoffer-deliver]", error)
    return NextResponse.json({ error: "DELIVER_FAILED" }, { status: 500 })
  }
}
