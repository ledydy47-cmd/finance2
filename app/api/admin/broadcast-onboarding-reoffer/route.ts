import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { broadcastOnboardingReofferToNewUsers } from "@/lib/server/onboarding-reoffer-service"

export const maxDuration = 300

export async function POST(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      datesYmd?: string[]
      message?: string
      offset?: number
      limit?: number
      skipAlreadySent?: boolean
    }

    const result = await broadcastOnboardingReofferToNewUsers(body)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[admin/broadcast-onboarding-reoffer]", error)
    return NextResponse.json({ error: "BROADCAST_FAILED" }, { status: 500 })
  }
}
