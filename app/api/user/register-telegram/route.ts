import { NextResponse } from "next/server"
import { registerTelegramUser } from "@/lib/server/telegram-users"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      telegramUserId?: number
      username?: string | null
      firstName?: string | null
    }

    if (!body.telegramUserId || !Number.isFinite(body.telegramUserId)) {
      return NextResponse.json({ error: "MISSING_TELEGRAM_USER_ID" }, { status: 400 })
    }

    const record = await registerTelegramUser({
      telegramUserId: body.telegramUserId,
      username: body.username,
      firstName: body.firstName,
    })

    return NextResponse.json({ ok: true, userKey: record.userKey })
  } catch (error) {
    console.error("[user/register-telegram]", error)
    return NextResponse.json({ error: "REGISTER_FAILED" }, { status: 500 })
  }
}
