import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { getAnalyticsSummary } from "@/lib/server/user-analytics-service"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const url = new URL(request.url)
    const month = url.searchParams.get("month")?.trim()
    const date = url.searchParams.get("date")
    const summary = await getAnalyticsSummary(
      month ? { monthYmd: month } : { dateYmd: date },
    )
    return NextResponse.json({ summary })
  } catch (error) {
    console.error("[admin/analytics/summary]", error)
    return NextResponse.json({ error: "SUMMARY_FAILED" }, { status: 500 })
  }
}
