import { NextResponse } from "next/server"
import { isAdminSupportAuthorized } from "@/lib/server/admin-auth"
import { getTelegramWebhookInfo, setTelegramWebhook } from "@/lib/server/telegram-bot-service"

export async function GET(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  const info = await getTelegramWebhookInfo()
  if (!info.ok) {
    return NextResponse.json(info, { status: 503 })
  }

  return NextResponse.json({ ok: true, info })
}

export async function POST(request: Request) {
  if (!isAdminSupportAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as { dropPendingUpdates?: boolean }
    const result = await setTelegramWebhook({
      dropPendingUpdates: body.dropPendingUpdates ?? false,
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: 503 })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("[admin/setup-telegram-webhook]", error)
    return NextResponse.json({ error: "SETUP_FAILED" }, { status: 500 })
  }
}
