import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { replyToSupportTicket } from "@/lib/server/support-service"

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const { id } = await context.params
    const body = (await request.json()) as { reply?: string }

    const result = await replyToSupportTicket({
      ticketId: id,
      reply: body.reply ?? "",
    })

    if (!result.ok) {
      const status = result.error === "NOT_FOUND" ? 404 : 400
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({
      ok: true,
      ticket: result.ticket,
      notified: result.notified,
    })
  } catch (error) {
    console.error("[admin/support/reply]", error)
    return NextResponse.json({ error: "REPLY_FAILED" }, { status: 500 })
  }
}
