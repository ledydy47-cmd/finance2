import { NextResponse } from "next/server"
import { isUserKeyBlocked } from "@/lib/server/blocked-users-service"
import { createSupportTicket } from "@/lib/server/support-service"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      message?: string
      userKey?: string
      telegramUserId?: number | null
      telegramUsername?: string | null
      userName?: string | null
    }

    if (!body.userKey?.trim()) {
      return NextResponse.json({ error: "MISSING_USER_KEY" }, { status: 400 })
    }

    if (await isUserKeyBlocked(body.userKey.trim())) {
      return NextResponse.json({ error: "USER_BLOCKED" }, { status: 403 })
    }

    const result = await createSupportTicket({
      message: body.message ?? "",
      userKey: body.userKey.trim(),
      telegramUserId: body.telegramUserId,
      telegramUsername: body.telegramUsername,
      userName: body.userName,
    })

    if (!result.ok) {
      const status = result.error === "MESSAGE_TOO_SHORT" ? 400 : 413
      return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ ok: true, ticketId: result.ticketId })
  } catch (error) {
    console.error("[support/tickets]", error)
    return NextResponse.json({ error: "CREATE_FAILED" }, { status: 500 })
  }
}
