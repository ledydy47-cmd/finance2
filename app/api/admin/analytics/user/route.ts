import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { findAnalyticsUser } from "@/lib/server/user-analytics-service"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const query = new URL(request.url).searchParams.get("q")?.trim()
  if (!query) {
    return NextResponse.json({ error: "MISSING_QUERY" }, { status: 400 })
  }

  try {
    const user = await findAnalyticsUser(query)
    if (!user) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
    }
    return NextResponse.json({ user })
  } catch (error) {
    console.error("[admin/analytics/user]", error)
    return NextResponse.json({ error: "LOOKUP_FAILED" }, { status: 500 })
  }
}
