import { NextResponse } from "next/server"
import { handleTelegramUpdate } from "@/lib/server/telegram-bot-service"

function getWebhookSecret() {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || process.env.CRON_SECRET?.trim() || ""
}

function isAuthorized(request: Request) {
  const secret = getWebhookSecret()
  if (!secret) return true

  const header = request.headers.get("x-telegram-bot-api-secret-token")
  if (header === secret) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const update = (await request.json()) as Parameters<typeof handleTelegramUpdate>[0]
    const result = await handleTelegramUpdate(update)
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("[telegram/webhook]", error)
    return NextResponse.json({ error: "WEBHOOK_FAILED" }, { status: 500 })
  }
}
