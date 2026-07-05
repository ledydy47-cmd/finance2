import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { listAnalyticsUsers } from "@/lib/server/user-analytics-service"
import type { UserSubscriptionFilter } from "@/lib/server/user-analytics-types"

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const filter = new URL(request.url).searchParams.get("filter") as
      | UserSubscriptionFilter
      | "all"
      | null

    const users = await listAnalyticsUsers(
      filter && filter !== "all" ? filter : undefined,
    )
    return NextResponse.json({ users })
  } catch (error) {
    console.error("[admin/analytics/users]", error)
    return NextResponse.json({ error: "LIST_FAILED" }, { status: 500 })
  }
}
