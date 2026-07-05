import { NextResponse } from "next/server"
import { syncUserSubscriptionPlan } from "@/lib/server/user-analytics-service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { userKey?: string }
    if (!body.userKey?.trim()) {
      return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
    }
    await syncUserSubscriptionPlan(body.userKey.trim())
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[analytics/sync]", error)
    return NextResponse.json({ error: "SYNC_FAILED" }, { status: 500 })
  }
}
