import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { listSupportTickets } from "@/lib/server/support-service"

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const tickets = await listSupportTickets()
    return NextResponse.json({ tickets })
  } catch (error) {
    console.error("[admin/support/tickets]", error)
    return NextResponse.json({ error: "LIST_FAILED" }, { status: 500 })
  }
}
