import { NextResponse } from "next/server"
import { queueAppReset } from "@/lib/server/app-reset"
import { clearFlashSaleState } from "@/lib/server/grant-custom-flash-sale"

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const header = request.headers.get("authorization")
  if (header === `Bearer ${secret}`) return true

  const url = new URL(request.url)
  return url.searchParams.get("secret") === secret
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
  }

  try {
    const body = (await request.json()) as {
      telegramUserId?: number
    }

    if (!body.telegramUserId || !Number.isFinite(body.telegramUserId)) {
      return NextResponse.json({ error: "MISSING_TELEGRAM_USER_ID" }, { status: 400 })
    }

    const userKey = `tg-${body.telegramUserId}`
    await clearFlashSaleState(userKey)

    const reset = await queueAppReset({
      userKey,
      settingsPatch: {
        paywallFlashSaleStartedAt: null,
        flashSaleDurationMs: null,
      },
    })

    return NextResponse.json({ ok: true, userKey, reset })
  } catch (error) {
    console.error("[admin/clear-flash-sale]", error)
    return NextResponse.json({ error: "CLEAR_FAILED" }, { status: 500 })
  }
}
