import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { listSupportTickets } from "@/lib/server/support-service"

export const maxDuration = 60

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const params = new URL(request.url).searchParams
    const status = params.get("status")
    const limitRaw = params.get("limit")

    let tickets = await listSupportTickets()
    if (status === "open" || status === "answered") {
      tickets = tickets.filter((ticket) => ticket.status === status)
    }
    if (limitRaw) {
      const limit = Number(limitRaw)
      if (Number.isFinite(limit) && limit > 0) {
        tickets = tickets.slice(0, Math.min(limit, 500))
      }
    }
    return NextResponse.json({ tickets })
  } catch (error) {
    console.error("[admin/support/tickets]", error)
    return NextResponse.json({ error: "LIST_FAILED" }, { status: 500 })
  }
}
