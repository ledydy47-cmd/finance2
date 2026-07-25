import { NextResponse } from "next/server"
import {
  syncUserAppState,
  syncUserSubscriptionPlan,
} from "@/lib/server/user-analytics-service"
import { processUserFlashSaleReminder, processUserFlashSaleReoffers } from "@/lib/server/flash-sale-cron-service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      userKey?: string
      homeWalkthroughCompleted?: boolean
      onboardingCompleted?: boolean
      firstExpenseAdded?: boolean
      paywallShown?: boolean
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
      firstExpenseAdded: body.firstExpenseAdded,
      paywallShown: body.paywallShown,
      userName: body.userName,
      age: body.age,
    })

    const reminder = await processUserFlashSaleReminder(userKey)
    const reoffers = await processUserFlashSaleReoffers(userKey)

    return NextResponse.json({ ok: true, reminder, reoffers })
  } catch (error) {
    console.error("[analytics/sync]", error)
    return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500 })
  }
}
