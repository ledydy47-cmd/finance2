import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { listAnalyticsUsers, listAnalyticsUsersPage } from "@/lib/server/user-analytics-service"
import type { UserSubscriptionFilter } from "@/lib/server/user-analytics-types"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const params = new URL(request.url).searchParams
    const filter = params.get("filter") as UserSubscriptionFilter | "all" | null
    const limitRaw = params.get("limit")
    const subscriptionFilter = filter && filter !== "all" ? filter : undefined

    if (limitRaw) {
      const limit = Number(limitRaw)
      const offset = Number(params.get("offset") ?? "0")
      const query = params.get("q") ?? undefined
      const page = await listAnalyticsUsersPage({
        filter: subscriptionFilter,
        limit: Number.isFinite(limit) ? limit : 50,
        offset: Number.isFinite(offset) ? offset : 0,
        query,
      })
      return NextResponse.json(page)
    }

    const users = await listAnalyticsUsers(subscriptionFilter)
    return NextResponse.json({ users })
  } catch (error) {
    console.error("[admin/analytics/users]", error)
    return NextResponse.json({ error: "LIST_FAILED" }, { status: 500 })
  }
}
