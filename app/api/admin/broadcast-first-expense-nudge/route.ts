import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { broadcastFirstExpenseNudge } from "@/lib/server/first-expense-nudge-broadcast"

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
    }

    const result = await broadcastFirstExpenseNudge(body)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[admin/broadcast-first-expense-nudge]", error)
    return NextResponse.json({ error: "BROADCAST_FAILED" }, { status: 500 })
  }
}
